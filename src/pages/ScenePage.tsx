import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AudioChannel } from '../components/TableAudio'
import type { AudioChannelHandle, AudioStatus } from '../components/TableAudio'
import { DiceOverlay } from '../components/DiceOverlay'
import { SceneAudioBar } from '../components/SceneAudioBar'
import { SurvivalControls } from '../components/SurvivalControls'
import { SurvivalHud } from '../components/SurvivalHud'
import type { TrackKey } from '../components/SurvivalHud'
import { Badge, Button, TabButton } from '../components/ui'
import { CreatureImage } from '../components/Portrait'
import { KIND_STYLE } from '../lib/sceneStyle'
import { useAuth } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { logNote } from '../lib/actions'
import { anchorFog, drawFog, emptyFog, frameOf, isRevealed, paintFog, setAll, viewFog } from '../lib/fog'
import { newId } from '../lib/id'
import { normalizeImageUrl } from '../lib/imageUrl'
import {
  EMPTY_MAP,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  clampMapOffsets,
  distanceInSquares,
  fitStage,
  freeSpot,
  gridColumns as sceneGridColumns,
  mapTransform,
  remapTokens,
  snapToGrid,
  squaresForTokenSize,
  stageAspect,
  tokenSquares,
  tokenWidth,
} from '../lib/sceneGeometry'
import { computeSurvivalEffects, consume } from '../lib/survival'
import { resolveAudioPlan, resolveVolumes } from '../lib/tableAudio'
import { resolveTokenStatus } from '../lib/tokenStatus'
import { resolveCreaturePortrait } from '../data/creatureArt'
import {
  addScenePing,
  cleanOldPings,
  listenCharacters,
  listenNPCs,
  listenScene,
  listenAudioTracks,
  listenSceneLibrary,
  listenScenePings,
  listenTable,
  saveScene,
  saveSceneTokens,
  updateCharacter,
  updateTable,
} from '../lib/store'
import { PING_LIFETIME_MS, SCENE_TOKEN_LABELS, emptySurvival } from '../types'
import type {
  AudioTrack,
  Character,
  GameTable,
  NPC,
  Scene,
  SceneFog,
  SceneLibraryItem,
  SceneMap,
  ScenePing,
  SceneAudio,
  SceneToken,
  SurvivalState,
  TimeOfDay,
} from '../types'
import { LibraryPanel, MapPanel, PiecesPanel } from './scenePanels'
import type { AddTokenFn } from './scenePanels'

const STAR_POSITIONS = [
  [8, 12], [17, 6], [23, 22], [34, 9], [41, 18], [52, 5], [61, 14], [69, 24],
  [77, 8], [85, 19], [91, 11], [14, 32], [29, 30], [47, 28], [64, 33], [80, 30],
  [6, 40], [37, 40], [58, 42], [95, 38],
] as const

const EMPTY_SCENE: Scene = { backgroundUrl: '', tokens: [], revealed: false, updatedAt: 0 }

type Tool = 'mover' | 'marcar' | 'regua' | 'mapa' | 'revelar' | 'esconder'
type Panel = 'mapa' | 'pecas' | 'biblioteca' | 'som'
interface Point {
  x: number
  y: number
}

/** Escuridão do local sem luz: forte o bastante para pesar, fraca o bastante
 * para o grupo continuar enxergando o mapa e as peças. */
const DARKNESS_ALPHA = 0.5
/** O Mestre precisa enxergar a cena que está narrando: para ele a escuridão é
 * só uma sombra que mostra até onde a luz chega, como a névoa. */
const DARKNESS_ALPHA_GM = 0.28
/**
 * Alcance da luz como fração da largura do palco (e não em px): assim a poça de
 * luz é exatamente a mesma em qualquer tela — o que importa agora que ela
 * decide quais criaturas os jogadores enxergam. O raio vertical é derivado da
 * proporção do palco, para a poça sair redonda em vez de achatada.
 */
const LIGHT_RX = 0.24
/** Fração do alcance que fica totalmente livre de escuridão. */
const LIGHT_CLEAR = 0.48
/** Até onde a luz ainda revela uma criatura para os jogadores. */
const LIGHT_REVEAL = 0.62
/** Tamanho do brilho quente (efeito de tocha) sobre o alcance da luz. */
const GLOW_SCALE = 0.65
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3.5
/** Folga em volta do palco, em px, para a borda dele não colar na janela. */
const STAGE_GUTTER = 12

/** A cena pode chegar incompleta (ex: nasceu só com o som): lemos sempre por
 * cima de um padrão, para nada tropeçar num campo que ainda não existe. */
function normalizeScene(s: Scene | null): Scene | null {
  return s ? { ...EMPTY_SCENE, ...s, tokens: s.tokens ?? [] } : null
}

/**
 * Tela de jogo compartilhada.
 *
 * A tela inteira é do mapa: o palco ocupa toda a altura que sobra da barra de
 * cima, em qualquer monitor. O JOGADOR vê só uma barra fina (onde está, se
 * está claro, o som e três ferramentas) e o mapa; o MESTRE tem, além disso,
 * uma linha de ações rápidas e quatro painéis — Mapa, Peças, Biblioteca e
 * Som — que abrem acima do palco e fecham quando ele termina.
 *
 * Enquanto o Mestre não "revela" a cena, os jogadores veem uma tela de espera.
 * Peças "preparadas" (onBoard=false) ficam numa bandeja só do Mestre até serem
 * colocadas no mapa, mesmo com a cena já revelada.
 */
export function ScenePage() {
  const { code = '' } = useParams()
  const tableId = code.toUpperCase()
  const { uid, loading } = useAuth()
  const [table, setTable] = useState<GameTable | null | undefined>(undefined)
  const [sceneState, setSceneState] = useState<Scene | null | undefined>(undefined)
  const [characters, setCharacters] = useState<Character[]>([])
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [library, setLibrary] = useState<SceneLibraryItem[]>([])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  /**
   * A área disponível para o palco nesta tela. Guardada em estado, e o
   * elemento também — um `useRef` não avisa o efeito quando o elemento nasce
   * (ele só aparece depois que a mesa carrega), e o palco ficava preso num
   * tamanho mínimo.
   */
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null)
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null)
  const [area, setArea] = useState({ width: 0, height: 0 })
  /**
   * Ferramenta ativa. Uma só de cada vez, para o arraste nunca ficar ambíguo:
   * "mover" é o normal (arrastar peças e navegar), "marcar" põe um sinal no
   * mapa para todos, "régua" mede, "mapa" passa o arraste e a roda para a
   * imagem de fundo e "revelar"/"esconder" pintam a névoa.
   */
  const [tool, setTool] = useState<Tool>('mover')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [snap, setSnap] = useState(true)
  const [brush, setBrush] = useState(4)
  const [ruler, setRuler] = useState<{ from: Point; to: Point } | null>(null)
  const [pings, setPings] = useState<ScenePing[]>([])
  const [survivalOpen, setSurvivalOpen] = useState(false)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  /** O navegador só toca som depois de um gesto — daí o botão de liberar. */
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [audioStatus, setAudioStatus] = useState<Record<string, AudioStatus>>({})
  const audioHandles = useRef<Record<string, AudioChannelHandle>>({})
  const mapEdit = tool === 'mapa'
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const boardRef = useRef<HTMLDivElement>(null)
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const mapDrag = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const fogPaint = useRef<'revelar' | 'esconder' | null>(null)
  const rulerDrag = useRef(false)
  const seenPings = useRef(new Set<string>())
  const dragIdRef = useRef<string | null>(null)
  const survivalRef = useRef<SurvivalState | undefined>(undefined)
  const charactersRef = useRef<Character[]>([])
  const survivalBusy = useRef(false)
  const aspectProbed = useRef('')
  /**
   * Base de um ajuste de enquadramento: o estado de quando o Mestre PEGOU o
   * controle. O remapeamento de peças e névoa sempre parte daqui, e não do
   * passo anterior — arrastar um controle gera dezenas de mudanças, e refazer
   * a malha da névoa em cima de si mesma a cada passo borrava as bordas.
   */
  const mapAdjustBase = useRef<{ map: SceneMap; tokens: SceneToken[] } | null>(null)
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  // O listener da roda é nativo e não é recriado a cada render; estas refs dão
  // a ele acesso ao estado atual sem precisar reanexá-lo o tempo todo.
  const mapEditRef = useRef(false)
  const sceneRef = useRef<Scene>(EMPTY_SCENE)
  const persistRef = useRef<(next: Scene) => void>(() => {})
  const paintAtRef = useRef<(x: number, y: number) => void>(() => {})
  const adjustMapRef = useRef<(patch: Partial<SceneMap>) => void>(() => {})

  const scene = sceneState ?? EMPTY_SCENE
  const timeOfDay: TimeOfDay = scene.timeOfDay ?? 'day'
  const locationLit = scene.locationLit ?? true
  const map: SceneMap = { ...EMPTY_MAP, ...scene.map }
  const aspect = stageAspect(scene)
  const lightRy = LIGHT_RX * aspect
  const columns = sceneGridColumns(scene)
  const stage = fitStage(area.width - STAGE_GUTTER * 2, area.height - STAGE_GUTTER * 2, aspect)
  const survival = table?.survival
  const audioPlan = resolveAudioPlan(table, scene, audioTracks)
  const audioVolumes = resolveVolumes(scene)
  const hasYoutubeTrack = audioTracks.some((t) => t.source === 'youtube')
  /**
   * De quem é a vez no combate. A ordem guarda `char:<id>` / `npc:<id>`, que é
   * exatamente o par refType/refId que a peça carrega — por isso dá para
   * acender a peça certa sem procurar por nome.
   */
  const activeCombatant =
    table?.combatActive && table.combatOrder.length > 0
      ? table.combatOrder[table.combatTurnIndex % table.combatOrder.length]
      : undefined
  const myCharacter = characters.find((c) => c.ownerUid === uid)
  /**
   * A névoa como aparece agora: a malha guardada levada do enquadramento em que
   * foi pintada até o de agora (o terreno se move, a névoa vai junto) e na
   * quantidade de linhas da proporção do palco.
   */
  const { rotation: mapRotation = 0, zoom: mapZoom = 1, offsetX: mapOffsetX = 0, offsetY: mapOffsetY = 0 } = map
  const fog: SceneFog | undefined = useMemo(
    () => viewFog(scene.fog, { rotation: mapRotation, zoom: mapZoom, offsetX: mapOffsetX, offsetY: mapOffsetY }, aspect),
    [scene.fog, mapRotation, mapZoom, mapOffsetX, mapOffsetY, aspect],
  )

  // Relógio simples para saber se uma fonte de luz de personagem ainda está
  // ativa (lightUntil) — não precisa de precisão de segundo, só reagir a tempo.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!firebaseConfigured) return
    return listenTable(tableId, setTable)
  }, [tableId])

  useEffect(() => {
    if (!firebaseConfigured) return
    return listenScene(tableId, (raw) => {
      const s = normalizeScene(raw)
      const dragging = dragIdRef.current
      if (dragging && s) {
        // Durante um arraste, a peça na mão continua onde o cursor está; todo
        // o resto (a peça que um jogador moveu, a névoa, a luz) entra normal.
        // Descartar a atualização inteira, como antes, fazia o próximo
        // salvamento desfazer o que os outros tinham acabado de mudar.
        setSceneState((prev) => {
          const held = prev?.tokens.find((t) => t.id === dragging)
          return { ...s, tokens: s.tokens.map((t) => (t.id === dragging && held ? { ...t, x: held.x, y: held.y } : t)) }
        })
        return
      }
      setSceneState(s)
    })
  }, [tableId])

  const isGM = Boolean(uid && table && table.gmUid === uid)

  useEffect(() => {
    if (!firebaseConfigured || !isGM) return
    return listenSceneLibrary(tableId, setLibrary)
  }, [tableId, isGM])

  useEffect(() => {
    if (!firebaseConfigured) return
    const unsubChars = listenCharacters(tableId, setCharacters)
    const unsubNpcs = listenNPCs(tableId, setNpcs)
    return () => {
      unsubChars()
      unsubNpcs()
    }
  }, [tableId])

  // O palco é o maior retângulo com a proporção da cena que cabe no espaço
  // que sobra da barra de cima — largura E altura. Medir aqui (em vez de deixar
  // para o CSS) é o que garante que 0..1 signifique o mesmo ponto do mapa na
  // tela do Mestre e na de cada jogador.
  useEffect(() => {
    if (!wrapEl) return
    const measure = () => setArea({ width: wrapEl.clientWidth, height: wrapEl.clientHeight })
    const obs = new ResizeObserver(measure)
    obs.observe(wrapEl)
    measure()
    return () => obs.disconnect()
  }, [wrapEl])

  useEffect(() => {
    mapEditRef.current = isGM && mapEdit
  }, [isGM, mapEdit])

  // Trocar de ferramenta apaga a medição: senão a linha da régua ficava
  // pendurada no mapa depois de já ter servido.
  useEffect(() => {
    if (tool !== 'regua') setRuler(null)
  }, [tool])

  useEffect(() => {
    if (!firebaseConfigured) return
    return listenAudioTracks(tableId, setAudioTracks)
  }, [tableId])

  // Marcações do mapa: entram, piscam e saem sozinhas. Guardamos as já vistas
  // para uma marcação antiga não voltar a piscar quando o listener recarrega.
  useEffect(() => {
    if (!firebaseConfigured) return
    return listenScenePings(tableId, (list) => {
      const fresh = list.filter((p) => p.at > Date.now() - PING_LIFETIME_MS && !seenPings.current.has(p.id))
      if (fresh.length === 0) return
      for (const p of fresh) {
        seenPings.current.add(p.id)
        setTimeout(() => setPings((prev) => prev.filter((x) => x.id !== p.id)), PING_LIFETIME_MS)
      }
      setPings((prev) => [...prev, ...fresh])
    })
  }, [tableId])

  useEffect(() => {
    if (!isGM) return
    void cleanOldPings(tableId).catch(() => {})
  }, [isGM, tableId])

  /** Mudança de cena do Mestre: grava o documento inteiro. */
  const persist = useCallback(
    (next: Scene) => {
      sceneRef.current = next
      setSceneState(next)
      void saveScene(tableId, next).catch((err) => console.error('Erro ao salvar a cena', err))
    },
    [tableId],
  )

  /** Peças movidas: grava só as peças — é o que o jogador pode mudar, e é o
   *  que impede o arraste do Mestre de desfazer o que mudou por outro lado. */
  const persistTokens = useCallback(
    (tokens: SceneToken[]) => {
      sceneRef.current = { ...sceneRef.current, tokens }
      setSceneState((prev) => ({ ...(prev ?? EMPTY_SCENE), tokens }))
      void saveSceneTokens(tableId, tokens).catch((err) => console.error('Erro ao mover a peça', err))
    },
    [tableId],
  )

  useEffect(() => {
    sceneRef.current = sceneState ?? EMPTY_SCENE
    persistRef.current = persist
    charactersRef.current = characters
  })

  // O eco do Firestore manda: se o Mestre mexeu nos ajustes (ou outra aba
  // escreveu), a ref acompanha o documento.
  useEffect(() => {
    survivalRef.current = survival
  }, [survival])

  /**
   * Relógio da privação. Só o navegador do Mestre aplica os efeitos — é o único
   * que pode escrever nas fichas de todo mundo. O cálculo é idempotente: se
   * nada mudou, nada é escrito, então rodar de novo não cobra dano duas vezes.
   */
  useEffect(() => {
    if (!isGM || !survival?.enabled) return
    let cancelled = false

    async function run() {
      // Uma passada de cada vez: aplicar dano leva várias escritas, e duas
      // passadas ao mesmo tempo cobrariam o mesmo tique duas vezes.
      if (survivalBusy.current) return
      survivalBusy.current = true
      try {
        const effects = computeSurvivalEffects(survivalRef.current, charactersRef.current, Date.now())
        if (cancelled || (effects.characterUpdates.length === 0 && !effects.survival)) return
        // O novo estado da privação vai primeiro — e a ref é atualizada na hora,
        // sem esperar o eco do Firestore. É isso que impede o tique de ser
        // cobrado de novo enquanto a escrita ainda está a caminho.
        if (effects.survival) {
          survivalRef.current = effects.survival
          await updateTable(tableId, { survival: effects.survival })
        }
        for (const u of effects.characterUpdates) {
          await updateCharacter(tableId, u.characterId, u.patch)
        }
        for (const msg of effects.logs) {
          await logNote({ tableId, actorName: 'Mestre', actorType: 'gm' }, msg, 'table')
        }
      } catch (err) {
        console.error('Erro ao aplicar fome e sede', err)
      } finally {
        survivalBusy.current = false
      }
    }

    void run()
    const id = setInterval(() => void run(), 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // Depende do estado da privação (para reagir na hora quando o Mestre come,
    // reabastece ou muda os tempos), mas *não* das fichas: elas são lidas por
    // ref. Se dependesse delas, cada escrita numa ficha reiniciaria o efeito e
    // cobraria o mesmo tique de novo, num laço.
  }, [isGM, survival, tableId])

  /**
   * Primeira vez que um mapa entra: o palco assume a proporção da própria
   * imagem, para ela caber inteira sem faixas pretas. Depois disso o Mestre
   * manda — não mexemos mais sozinhos.
   */
  useEffect(() => {
    if (!isGM || !scene.backgroundUrl) return
    if (scene.map?.aspect) return
    if (aspectProbed.current === scene.backgroundUrl) return
    aspectProbed.current = scene.backgroundUrl
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const cur = sceneRef.current
      persist({ ...cur, map: { ...cur.map, aspect: img.naturalWidth / img.naturalHeight } })
    }
    img.src = scene.backgroundUrl
  }, [isGM, scene, persist])

  /**
   * Liberar o som precisa acontecer *dentro* do clique: é o gesto que o
   * navegador exige. Por isso os canais são acionados aqui, e não num efeito
   * depois que o estado mudou — que em celular já não vale como gesto.
   */
  function enableAudio() {
    for (const handle of Object.values(audioHandles.current)) handle.unlock()
    setAudioEnabled(true)
  }

  function registerAudioChannel(label: string, handle: AudioChannelHandle | null) {
    if (handle) audioHandles.current[label] = handle
    else delete audioHandles.current[label]
  }

  function patchAudio(patch: Partial<SceneAudio>) {
    const cur = sceneRef.current
    persist({ ...cur, audio: { ...cur.audio, ...patch } })
  }

  /** Mudança de enquadramento que não move o terreno (proporção, encaixe). */
  function patchMap(patch: Partial<SceneMap>) {
    const cur = sceneRef.current
    persist({ ...cur, map: { ...EMPTY_MAP, ...cur.map, ...patch } })
  }

  function beginMapAdjust() {
    if (mapAdjustBase.current) return
    const cur = sceneRef.current
    mapAdjustBase.current = { map: { ...EMPTY_MAP, ...cur.map }, tokens: cur.tokens }
  }

  function endMapAdjust() {
    mapAdjustBase.current = null
  }

  /**
   * Gira, dá zoom ou desloca o mapa levando o terreno junto: as peças e a
   * névoa pintada acompanham o chão em que estavam. Sem isso o mapa
   * escorregava por baixo delas e "o que foi revelado" deixava de bater com o
   * que está embaixo.
   */
  function adjustMap(patch: Partial<SceneMap>) {
    const cur = sceneRef.current
    const base = mapAdjustBase.current ?? { map: { ...EMPTY_MAP, ...cur.map }, tokens: cur.tokens }
    // Diminuir o zoom encolhe o quanto o mapa pode escorregar: o deslocamento
    // é preso ao novo limite, senão a imagem sairia do palco sem volta.
    const next = clampMapOffsets({ ...base.map, ...patch })
    persist({
      ...cur,
      map: next,
      tokens: remapTokens(base.tokens, base.map, next, aspect),
      // A névoa não é refeita: ela é desenhada a partir do enquadramento em
      // que foi pintada. Névoa antiga, sem esse registro, ganha agora o de
      // antes do ajuste — e dali em diante acompanha o terreno.
      fog: cur.fog && !cur.fog.anchor ? anchorFog(cur.fog, base.map) : cur.fog,
    })
  }

  /** Grava uma névoa que já está no enquadramento de agora. */
  function patchFog(next: SceneFog) {
    const cur = sceneRef.current
    persist({ ...cur, fog: anchorFog(next, frameOf(cur.map)) })
  }

  function ping(at: Point) {
    const label = isGM ? 'Mestre' : (myCharacter?.name ?? 'Jogador')
    void addScenePing(tableId, { ...at, label }).catch((err) => console.error('Erro ao marcar o mapa', err))
  }

  function consumeSupply(track: TrackKey) {
    const base: SurvivalState = survival ?? emptySurvival()
    const key = track === 'food' ? 'hunger' : 'thirst'
    void updateTable(tableId, {
      survival: { ...base, enabled: true, [key]: consume(base[key], Date.now()) },
    })
  }

  function toggleTimeOfDay() {
    const next: TimeOfDay = timeOfDay === 'day' ? 'night' : 'day'
    persist({ ...sceneRef.current, timeOfDay: next, locationLit: next === 'day' })
    setAnnouncement(next === 'night' ? 'A noite cai sobre as Terras Sombrias...' : 'O dia amanhece, cinzento e avermelhado...')
    setTimeout(() => setAnnouncement(null), 3200)
  }

  function toggleLocationLit() {
    persist({ ...sceneRef.current, locationLit: !locationLit })
  }

  function onBoardSpots(exceptId?: string) {
    return sceneRef.current.tokens.filter((t) => t.onBoard !== false && t.id !== exceptId)
  }

  const addToken: AddTokenFn = (token, opts) => {
    // O tamanho vem em quadrados: a peça já nasce na escala do mapa atual, e
    // continua proporcional às outras se o Mestre mudar a escala depois.
    const squares = opts?.squares ?? (opts?.size ? squaresForTokenSize(opts.size) : token.kind === 'boss' ? 2 : 1)
    // Nasce numa casa livre, e não no centro em cima da peça anterior.
    const at = opts?.at ?? freeSpot(onBoardSpots(), squares, columns, aspect)
    const newToken: SceneToken = {
      ...token,
      id: newId(),
      x: at.x,
      y: at.y,
      squares,
      size: Math.min(1, squares / columns),
      onBoard: opts?.onBoard ?? true,
    }
    const cur = sceneRef.current
    persist({ ...cur, tokens: [...cur.tokens, newToken] })
  }

  function updateToken(id: string, patch: Partial<SceneToken>) {
    const cur = sceneRef.current
    persist({ ...cur, tokens: cur.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  }

  /** Pôr no mapa é também achar onde: mesma regra da peça nova. */
  function putOnBoard(id: string) {
    const t = sceneRef.current.tokens.find((x) => x.id === id)
    if (!t) return
    const spot = freeSpot(onBoardSpots(id), tokenSquares(t, columns), columns, aspect)
    updateToken(id, { onBoard: true, ...spot })
  }

  function removeToken(id: string) {
    const cur = sceneRef.current
    persist({ ...cur, tokens: cur.tokens.filter((t) => t.id !== id) })
  }

  function pointerToRelative(clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0.5, y: 0.5 }
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  // Arrastar peças. A peça em arraste vive numa ref, e não no estado: os
  // listeners ficam sempre ligados, então nenhum movimento se perde no intervalo
  // entre o clique e o próximo render. Durante o arraste só o estado local muda;
  // ao soltar, grava uma vez — e só as peças.
  useEffect(() => {
    function place(base: Scene, clientX: number, clientY: number) {
      const id = dragIdRef.current
      const raw = pointerToRelative(clientX, clientY)
      return {
        ...base,
        tokens: base.tokens.map((t) => {
          if (t.id !== id) return t
          const pos = snap ? snapToGrid(raw.x, raw.y, tokenSquares(t, columns), columns, aspect) : raw
          return { ...t, ...pos }
        }),
      }
    }
    function onMove(e: PointerEvent) {
      if (!dragIdRef.current) return
      setSceneState((s) => {
        const next = place(s ?? EMPTY_SCENE, e.clientX, e.clientY)
        sceneRef.current = next
        return next
      })
    }
    function onUp(e: PointerEvent) {
      if (!dragIdRef.current) return
      // O `pointerup` pode chegar antes de o React repintar: a ref é sempre a
      // versão mais recente da cena, então é dela que sai o que vai gravado.
      const next = place(sceneRef.current, e.clientX, e.clientY)
      dragIdRef.current = null
      persistTokens(next.tokens)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, snap, columns, aspect, persistTokens])

  // Roda do mouse: zoom da lente de cada um. Com "Ajustar mapa", o zoom da
  // IMAGEM, levando peças e névoa junto. Listener nativo não-passivo, para
  // poder cancelar o scroll da página.
  useEffect(() => {
    const el = viewportEl
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (mapEditRef.current) {
        // Uma rodada de roda é um ajuste só: a base é pega no primeiro tique e
        // solta quando a roda para.
        beginMapAdjust()
        if (wheelIdle.current) clearTimeout(wheelIdle.current)
        wheelIdle.current = setTimeout(() => {
          wheelIdle.current = null
          endMapAdjust()
        }, 400)
        const current = { ...EMPTY_MAP, ...sceneRef.current.map }
        const next = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, (current.zoom ?? 1) - e.deltaY * 0.0015))
        adjustMapRef.current({ zoom: Number(next.toFixed(3)) })
        return
      }
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [viewportEl])

  // Arrastar o fundo para "andar" pelo mapa (pan). Ignorado se o pointerdown
  // começou em cima de uma peça (que já usa stopPropagation).
  function onViewportPointerDown(e: React.PointerEvent) {
    // Alt + clique marca o mapa para todo mundo, com qualquer ferramenta ativa.
    if (e.altKey || tool === 'marcar') {
      e.preventDefault()
      ping(pointerToRelative(e.clientX, e.clientY))
      return
    }
    if (isGM && tool === 'mapa') {
      beginMapAdjust()
      mapDrag.current = { startX: e.clientX, startY: e.clientY, offsetX: map.offsetX ?? 0, offsetY: map.offsetY ?? 0 }
      return
    }
    if (isGM && (tool === 'revelar' || tool === 'esconder')) {
      fogPaint.current = tool
      paintAt(e.clientX, e.clientY)
      return
    }
    if (tool === 'regua') {
      const at = pointerToRelative(e.clientX, e.clientY)
      rulerDrag.current = true
      setRuler({ from: at, to: at })
      return
    }
    panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }

  /** Pinta a névoa sob o cursor, criando a malha na primeira pincelada. */
  function paintAt(clientX: number, clientY: number) {
    if (!fogPaint.current) return
    const at = pointerToRelative(clientX, clientY)
    const cur = sceneRef.current
    // O pincel pinta a névoa como ela aparece agora, e ela é gravada já com o
    // enquadramento de agora como ponto de partida.
    const base = viewFog(cur.fog, frameOf(cur.map), aspect) ?? emptyFog(aspect)
    const next = paintFog(base, at.x, at.y, brush, fogPaint.current === 'revelar')
    if (next.cells === base.cells && cur.fog) return
    persistRef.current({ ...cur, fog: anchorFog({ ...next, enabled: true }, frameOf(cur.map)) })
  }

  // O pincel e o ajuste de mapa são chamados pelo listener global de ponteiro,
  // que não é recriado a cada render; as refs dão a ele a versão atual.
  useEffect(() => {
    paintAtRef.current = paintAt
    adjustMapRef.current = adjustMap
  })
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (fogPaint.current) {
        paintAtRef.current(e.clientX, e.clientY)
        return
      }
      if (rulerDrag.current) {
        const rect = boardRef.current?.getBoundingClientRect()
        if (rect) {
          setRuler((r) =>
            r
              ? {
                  ...r,
                  to: {
                    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
                    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
                  },
                }
              : r,
          )
        }
        return
      }
      if (mapDrag.current) {
        // Move a imagem dentro do palco. Divide pelo tamanho do palco (e pelo
        // zoom da lente) para o mapa acompanhar o cursor na proporção certa.
        const { startX, startY, offsetX, offsetY } = mapDrag.current
        const w = stage.width * zoom || 1
        const h = stage.height * zoom || 1
        adjustMapRef.current({
          offsetX: Number((offsetX + (e.clientX - startX) / w).toFixed(4)),
          offsetY: Number((offsetY + (e.clientY - startY) / h).toFixed(4)),
        })
        return
      }
      if (!panDrag.current) return
      const { startX, startY, panX, panY } = panDrag.current
      setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) })
    }
    function onUp() {
      panDrag.current = null
      // Soltar o ponteiro encerra qualquer ajuste de mapa — arraste no palco ou
      // controle deslizante do painel, mesmo que ele tenha sido solto fora.
      if (!wheelIdle.current) endMapAdjust()
      mapDrag.current = null
      fogPaint.current = null
      rulerDrag.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [stage.width, stage.height, zoom])

  /** Aceita imagens arrastadas de outra aba/página (URL) direto no tabuleiro. */
  function onDrop(e: React.DragEvent) {
    if (!isGM) return
    e.preventDefault()
    const raw = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || ''
    if (!raw.trim()) return
    const url = normalizeImageUrl(raw)
    const pos = pointerToRelative(e.clientX, e.clientY)
    // Segurando Shift, a imagem vira o mapa de fundo em vez de uma peça.
    // Trocar o fundo é começar outra cena: o vínculo com a biblioteca cai.
    if (e.shiftKey) persist({ ...sceneRef.current, backgroundUrl: url, fromLibraryId: undefined })
    else addToken({ label: 'Novo ícone', imageUrl: url, kind: 'monster' }, { at: pos })
  }

  if (!firebaseConfigured) {
    return <p className="p-8 text-center text-amber-300">Firebase não configurado. Veja o README.</p>
  }
  if (table === undefined || loading || sceneState === undefined) {
    return <p className="p-8 text-center text-purple-300/60">Carregando tela...</p>
  }
  if (table === null) return <p className="p-8 text-center text-red-300">Mesa não encontrada.</p>

  const showWaitingScreen = !isGM && (sceneState === null || !sceneState.revealed)
  // Jogadores nunca veem peças ainda "preparadas" na bandeja do Mestre.
  const boardTokens = scene.tokens.filter((t) => t.onBoard !== false)
  const stagedTokens = scene.tokens.filter((t) => t.onBoard === false)

  // Sem luz no local: escurece o mapa inteiro, com "furos" de luz ao redor de
  // cada personagem com uma fonte de iluminação ativa (lightUntil no futuro).
  const litTokens = boardTokens.filter((t) => {
    if (t.refType !== 'character') return false
    const c = characters.find((x) => x.id === t.refId)
    return Boolean(c?.lightUntil && c.lightUntil > now)
  })

  /** A peça é do jogador que está olhando? */
  function isMine(t: SceneToken) {
    return t.refType === 'character' && Boolean(myCharacter) && t.refId === myCharacter?.id
  }

  /**
   * No escuro, monstros e chefes fora do alcance de qualquer luz somem da tela
   * dos jogadores — o Mestre continua vendo, marcados como ocultos. Personagens
   * e NPCs seguem visíveis: o grupo sabe onde os seus estão.
   */
  function hiddenInTheDark(t: SceneToken) {
    // Terreno ainda não explorado esconde qualquer peça — menos a sua própria,
    // que é como o jogador se localiza no mapa.
    if (fog?.enabled && !isMine(t) && !isRevealed(fog, t.x, t.y)) return true
    if (t.kind !== 'monster' && t.kind !== 'boss') return false
    if (locationLit) return false
    return !litTokens.some((l) => {
      const dx = (t.x - l.x) / (LIGHT_RX * LIGHT_REVEAL)
      const dy = (t.y - l.y) / (lightRy * LIGHT_REVEAL)
      return dx * dx + dy * dy <= 1
    })
  }

  /** Esta peça é de quem está agindo agora? */
  function isActiveTurn(t: SceneToken) {
    if (!activeCombatant || !t.refType || !t.refId) return false
    return activeCombatant === `${t.refType === 'character' ? 'char' : 'npc'}:${t.refId}`
  }

  /**
   * Quem pode arrastar esta peça. O Mestre move tudo; o jogador só move a peça
   * ligada à própria ficha, e só quando o Mestre libera na mesa.
   */
  function canDrag(t: SceneToken) {
    if (tool !== 'mover') return false
    if (isGM) return true
    if (!table?.playersMoveTokens) return false
    return isMine(t)
  }

  // O Mestre vê também as peças da bandeja, esmaecidas, como sempre viu.
  const visibleTokens = isGM ? scene.tokens : boardTokens.filter((t) => !hiddenInTheDark(t))
  // A escuridão deixa o mapa sombrio, mas nunca cega: ainda dá para enxergar o
  // cenário e as peças fora do alcance da luz — só com bem menos nitidez.
  // As camadas ficam sempre montadas e só mudam de opacidade, para a escuridão
  // entrar e sair junto com a transição do céu em vez de aparecer de estalo.
  const darkAlpha = isGM ? DARKNESS_ALPHA_GM : DARKNESS_ALPHA
  const darkEllipse = `${(LIGHT_RX * 100).toFixed(2)}% ${(lightRy * 100).toFixed(2)}%`
  const glowEllipse = `${(LIGHT_RX * GLOW_SCALE * 100).toFixed(2)}% ${(lightRy * GLOW_SCALE * 100).toFixed(2)}%`
  const darknessBackground = [
    ...litTokens.map(
      (t) =>
        `radial-gradient(ellipse ${darkEllipse} at ${t.x * 100}% ${t.y * 100}%, rgba(3,4,12,0) 0%, rgba(3,4,12,0) ${LIGHT_CLEAR * 100}%, rgba(3,4,12,0.3) 74%, rgba(3,4,12,${darkAlpha}) 100%)`,
    ),
    `linear-gradient(rgba(3,4,12,${darkAlpha}), rgba(3,4,12,${darkAlpha}))`,
  ].join(', ')

  // Camada aditiva (blend "screen"): a tocha realmente clareia o que está por
  // perto, em vez de apenas "furar" a escuridão.
  const lightGlowBackground = litTokens
    .map(
      (t) =>
        `radial-gradient(ellipse ${glowEllipse} at ${t.x * 100}% ${t.y * 100}%, rgba(255,205,135,0.62) 0%, rgba(255,182,96,0.4) 35%, rgba(120,70,20,0.12) 70%, rgba(0,0,0,0) 100%)`,
    )
    .join(', ')

  const tools: [Tool, string, string][] = [
    ['mover', '✋ Mover', 'Arrastar peças e navegar pelo mapa'],
    ['marcar', '📍 Marcar', 'Clique no mapa para chamar a atenção de todos para um ponto (Alt + clique também marca)'],
    ['regua', '📏 Régua', 'Arraste de um ponto a outro para medir em quadrados'],
    ...(isGM
      ? ([
          ['mapa', '🖼️ Ajustar mapa', 'Arraste e role para enquadrar a imagem — as peças e a névoa vão junto'],
          ['revelar', '🔦 Revelar', 'Pinte o que o grupo já explorou'],
          ['esconder', '🌫️ Esconder', 'Volte a esconder uma área'],
        ] as [Tool, string, string][])
      : []),
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* A animação de dados também roda aqui — é onde a mesa está olhando. As
          rolagens secretas do Mestre ficam de fora, porque só entram no log
          secreto, que esta tela não escuta. */}
      <DiceOverlay tableId={tableId} isGM={false} />

      {/* Os canais em si não desenham nada — só tocam. Ficam fora da tela de
          espera para o som começar junto com a cena. */}
      {!showWaitingScreen &&
        (
          [
            ['ambience', audioPlan.ambience, audioVolumes.ambience],
            ['mood', audioPlan.mood, audioVolumes.mood],
            ['combat', audioPlan.combat, audioVolumes.combat],
          ] as [string, typeof audioPlan.ambience, number][]
        ).map(([name, track, vol]) => (
          <AudioChannel
            key={name}
            label={name}
            track={track}
            volume={vol}
            enabled={audioEnabled}
            // O player do YouTube é criado de saída se a mesa tem qualquer
            // faixa de lá: ele precisa estar pronto quando o clique chegar.
            preloadYoutube={hasYoutubeTrack}
            onRegister={registerAudioChannel}
            onStatus={(st) =>
              setAudioStatus((prev) =>
                prev[name]?.state === st.state && prev[name]?.message === st.message ? prev : { ...prev, [name]: st },
              )
            }
          />
        ))}

      {/* Barra de comando: fina para o jogador; o Mestre ganha uma segunda linha. */}
      <div
        data-scene-bar=""
        className="z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--gold-dark)]/50 bg-[var(--surface-card)] px-3 py-2"
      >
        <span className="font-serif text-purple-100">{table.name}</span>
        {!showWaitingScreen && (
          <>
            <Badge>{timeOfDay === 'day' ? '🌇 Dia' : '🌑 Noite'}</Badge>
            <Badge tone={locationLit ? 'good' : 'bad'}>{locationLit ? '💡 Iluminado' : '🌑 Sem luz'}</Badge>
            {table.combatActive && <Badge tone="bad">⚔️ Combate</Badge>}
            <SceneAudioBar
              mode="bar"
              isGM={isGM}
              tracks={audioTracks}
              scene={scene}
              plan={audioPlan}
              volumes={audioVolumes}
              enabled={audioEnabled}
              statuses={audioStatus}
              onEnable={enableAudio}
              onDisable={() => setAudioEnabled(false)}
              onPatchAudio={patchAudio}
            />
          </>
        )}
        {showWaitingScreen && <Badge tone="bad">aguardando o Mestre</Badge>}

        {!showWaitingScreen && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5" data-scene-tools="">
            {tools.map(([key, label, hint]) => (
              <Button
                key={key}
                title={hint}
                data-tool={key}
                variant={tool === key ? 'primary' : 'secondary'}
                className="px-2.5 py-1 text-xs"
                onClick={() => setTool(key)}
              >
                {label}
              </Button>
            ))}
            {isGM && (tool === 'revelar' || tool === 'esconder') && (
              <label className="flex items-center gap-1.5 text-xs text-purple-200">
                pincel
                <input type="range" min={1} max={14} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-20" />
                <span className="w-5 tabular-nums">{brush}</span>
              </label>
            )}
          </div>
        )}

        {isGM && (
          <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-purple-900/40 pt-2" data-gm-actions="">
            <Button
              variant={scene.revealed ? 'danger' : 'primary'}
              className="px-2.5 py-1 text-xs"
              onClick={() => persist({ ...sceneRef.current, revealed: !scene.revealed })}
            >
              {scene.revealed ? '🙈 Ocultar (tela de espera)' : '👁 Revelar aos jogadores'}
            </Button>
            <Button className="px-2.5 py-1 text-xs" onClick={toggleTimeOfDay}>
              {timeOfDay === 'day' ? '🌙 Anoitecer' : '🌇 Amanhecer'}
            </Button>
            <Button className="px-2.5 py-1 text-xs" onClick={toggleLocationLit}>
              {locationLit ? 'Escurecer local' : 'Iluminar local'}
            </Button>
            <Button className="px-2.5 py-1 text-xs" onClick={() => persist({ ...sceneRef.current, showGrid: !scene.showGrid })}>
              {scene.showGrid ? 'Esconder grade' : 'Mostrar grade'}
            </Button>
            {fog?.enabled ? (
              <>
                <Button className="px-2.5 py-1 text-xs" onClick={() => patchFog(setAll(fog, true))}>
                  Revelar tudo
                </Button>
                <Button className="px-2.5 py-1 text-xs" onClick={() => patchFog(setAll(fog, false))}>
                  Cobrir tudo
                </Button>
                <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => patchFog({ ...fog, enabled: false })}>
                  Desligar névoa
                </Button>
              </>
            ) : (
              <Button className="px-2.5 py-1 text-xs" onClick={() => patchFog(fog ? { ...fog, enabled: true } : emptyFog(aspect))}>
                🌫️ Ligar névoa
              </Button>
            )}
            <Button className="px-2.5 py-1 text-xs" onClick={() => setSurvivalOpen(true)}>
              🍖 Fome e sede
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-purple-200" title="Cada jogador arrasta só a peça do próprio personagem">
              <input
                type="checkbox"
                checked={Boolean(table.playersMoveTokens)}
                onChange={(e) => updateTable(tableId, { playersMoveTokens: e.target.checked })}
              />
              jogadores movem a própria peça
            </label>
            <div className="ml-auto flex flex-wrap gap-0.5" data-gm-panels="">
              {(
                [
                  ['mapa', 'Mapa'],
                  ['pecas', `Peças${stagedTokens.length ? ` (${stagedTokens.length} na bandeja)` : ''}`],
                  ['biblioteca', 'Biblioteca'],
                  ['som', 'Som'],
                ] as [Panel, string][]
              ).map(([key, label]) => (
                <TabButton key={key} data-panel={key} active={panel === key} onClick={() => setPanel(panel === key ? null : key)}>
                  {label}
                </TabButton>
              ))}
            </div>
          </div>
        )}
      </div>

      {isGM && panel && (
        <div
          data-open-panel={panel}
          className="z-10 max-h-[42vh] shrink-0 overflow-y-auto border-b border-[color:var(--gold-dark)]/40 bg-[var(--surface-card)]/95 p-3"
        >
          {panel === 'mapa' && (
            <MapPanel
              scene={scene}
              map={map}
              columns={columns}
              aspect={aspect}
              areaAspect={area.width > 0 && area.height > 0 ? area.width / area.height : aspect}
              mapEdit={mapEdit}
              snap={snap}
              onToggleSnap={() => setSnap((v) => !v)}
              onPatchMap={patchMap}
              onAdjustMap={adjustMap}
              onBeginAdjust={beginMapAdjust}
              onEndAdjust={endMapAdjust}
              onPatchScene={(patch) => persist({ ...sceneRef.current, ...patch })}
            />
          )}
          {panel === 'pecas' && (
            <PiecesPanel
              tableId={tableId}
              gmUid={table.gmUid}
              scene={scene}
              columns={columns}
              characters={characters}
              npcs={npcs}
              now={now}
              onAddToken={addToken}
              onUpdateToken={updateToken}
              onPutOnBoard={putOnBoard}
              onRemoveToken={removeToken}
              onClear={() => persist({ ...sceneRef.current, tokens: [] })}
            />
          )}
          {panel === 'biblioteca' && (
            <LibraryPanel tableId={tableId} scene={scene} library={library} onOpen={persist} onAddToken={addToken} />
          )}
          {panel === 'som' && (
            <div className="flex flex-col gap-2">
              <SceneAudioBar
                mode="panel"
                isGM={isGM}
                tracks={audioTracks}
                scene={scene}
                plan={audioPlan}
                volumes={audioVolumes}
                enabled={audioEnabled}
                statuses={audioStatus}
                onEnable={enableAudio}
                onDisable={() => setAudioEnabled(false)}
                onPatchAudio={patchAudio}
              />
              <p className="text-[11px] text-purple-400/50">
                As faixas são cadastradas no painel do Mestre, em "Itens &amp; Som". Aqui você escolhe o que toca.
              </p>
            </div>
          )}
        </div>
      )}

      {survivalOpen && isGM && (
        <SurvivalControls
          survival={survival}
          characters={characters}
          now={now}
          onChange={(next) => updateTable(tableId, { survival: next })}
          onClose={() => setSurvivalOpen(false)}
        />
      )}

      {/* O palco ocupa todo o resto da janela. */}
      <div ref={setWrapEl} className="relative min-h-0 flex-1 overflow-hidden bg-[var(--surface-board)]" data-scene-area="">
        {showWaitingScreen ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="text-4xl">🕯️</span>
            <p className="text-purple-200">O Mestre está preparando a cena...</p>
            <p className="text-xs text-purple-400/50">A tela vai aparecer automaticamente assim que ele revelar.</p>
          </div>
        ) : (
          <div
            ref={setViewportEl}
            onPointerDown={onViewportPointerDown}
            onDrop={onDrop}
            onDragOver={(e) => isGM && e.preventDefault()}
            className={`absolute inset-0 overflow-hidden ${tool === 'marcar' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ touchAction: 'none' }}
          >
            {/* Tom ambiente de dia/noite — não acompanha o zoom/pan, é a "luz do céu". */}
            <div
              className="pointer-events-none absolute inset-0 z-[4] transition-colors duration-[2500ms] ease-in-out"
              style={{ backgroundColor: timeOfDay === 'night' ? 'rgba(4, 6, 20, 0.4)' : 'rgba(120, 55, 45, 0.16)' }}
            />
            <div
              className="pointer-events-none absolute inset-0 z-[4] transition-opacity duration-[2500ms] ease-in-out"
              style={{ opacity: timeOfDay === 'night' ? 1 : 0 }}
            >
              {STAR_POSITIONS.map(([x, y], i) => (
                <span
                  key={i}
                  className="absolute h-[2px] w-[2px] rounded-full bg-purple-100 animate-star-twinkle"
                  style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 7) * 0.6}s` }}
                />
              ))}
            </div>
            {announcement && (
              <div className="pointer-events-none absolute inset-x-0 top-6 z-[6] flex justify-center">
                <p className="animate-fade-in-out rounded-full border border-purple-700/50 bg-black/70 px-4 py-1.5 text-sm text-purple-100">
                  {announcement}
                </p>
              </div>
            )}

            {survival?.enabled && (
              <div className="pointer-events-none absolute left-2 top-2 z-20">
                <SurvivalHud
                  survival={survival}
                  now={now}
                  isGM={isGM}
                  partySize={survival.partyIds.length}
                  onConsume={consumeSupply}
                />
              </div>
            )}

            <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex gap-1" data-lens="">
              <button
                className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-sm text-purple-100 hover:bg-black/80"
                title="Aproximar (só na sua tela)"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))}
              >
                +
              </button>
              <button
                className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-sm text-purple-100 hover:bg-black/80"
                title="Afastar (só na sua tela)"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))}
              >
                −
              </button>
              {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                <button
                  className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-xs text-purple-100 hover:bg-black/80"
                  title="Voltar a ver o mapa inteiro"
                  onClick={() => {
                    setZoom(1)
                    setPan({ x: 0, y: 0 })
                  }}
                >
                  mapa inteiro
                </button>
              )}
            </div>

            {/* Lente de cada um (zoom/arraste), por fora do palco: mexer nela não
                muda o enquadramento que os outros veem. */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
            >
              {/* O palco: retângulo de proporção fixa, igual em todas as telas. */}
              <div
                ref={boardRef}
                data-stage=""
                className="relative overflow-hidden bg-[var(--surface-board)] shadow-[0_0_0_1px_rgba(200,170,110,0.25)]"
                style={{ width: stage.width || undefined, height: stage.height || undefined }}
              >
                {scene.backgroundUrl ? (
                  <img
                    src={normalizeImageUrl(scene.backgroundUrl)}
                    alt=""
                    data-map=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full select-none"
                    style={{ objectFit: map.fit ?? 'contain', transform: mapTransform(map), transformOrigin: 'center center' }}
                  />
                ) : (
                  <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-purple-400/40">
                    {isGM ? 'Abra o painel "Mapa" para escolher a imagem — ou solte-a aqui segurando Shift.' : 'O Mestre ainda não abriu um mapa.'}
                  </p>
                )}

                {scene.showGrid && (
                  <div
                    data-grid=""
                    className="pointer-events-none absolute inset-0 z-[2]"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(200,170,110,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(200,170,110,0.28) 1px, transparent 1px)',
                      // A célula é quadrada DE VERDADE e igual à do encaixe: em
                      // Y ela mede aspect/colunas do palco. Contar linhas
                      // arredondadas fazia a grade desenhada não bater com o
                      // lugar onde as peças encaixavam.
                      backgroundSize: `${100 / columns}% ${(100 * aspect) / columns}%`,
                    }}
                  />
                )}

                {visibleTokens.map((t) => (
                  <SceneTokenView
                    key={t.id}
                    token={t}
                    width={tokenWidth(t, columns)}
                    activeTurn={isActiveTurn(t)}
                    hiddenFromPlayers={isGM && hiddenInTheDark(t)}
                    characters={characters}
                    npcs={npcs}
                    draggable={canDrag(t)}
                    onPointerDown={(e) => {
                      if (e.altKey || !canDrag(t)) return
                      e.preventDefault()
                      e.stopPropagation()
                      dragIdRef.current = t.id
                    }}
                  />
                ))}

                <div
                  className="pointer-events-none absolute inset-0 z-[3] transition-opacity duration-[2000ms] ease-in-out"
                  style={{ backgroundImage: darknessBackground, opacity: locationLit ? 0 : 1 }}
                  data-darkness={locationLit ? undefined : darkAlpha}
                />
                {lightGlowBackground && (
                  <div
                    className="pointer-events-none absolute inset-0 z-[4] transition-opacity duration-[2000ms] ease-in-out"
                    style={{
                      backgroundImage: lightGlowBackground,
                      mixBlendMode: 'screen',
                      opacity: locationLit ? 0 : 1,
                    }}
                  />
                )}

                {fog?.enabled && <FogLayer fog={fog} width={stage.width} height={stage.height} isGM={isGM} />}

                {ruler && <RulerOverlay ruler={ruler} columns={columns} aspect={aspect} />}

                {pings.map((p) => (
                  <span
                    key={p.id}
                    data-ping={p.label}
                    className="pointer-events-none absolute z-[9] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  >
                    <span className="animate-pulse-ring block h-10 w-10 rounded-full border-2 border-[color:var(--gold-bright)] bg-[color:var(--gold)]/25" />
                    <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 text-[10px] text-[color:var(--gold-bright)]">
                      {p.label}
                    </span>
                  </span>
                ))}

                {isGM && mapEdit && (
                  <div className="pointer-events-none absolute inset-0 z-[10] border-2 border-dashed border-[color:var(--gold)]/70" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Camada da névoa. É um canvas porque a borda em degradê nasce do desenho: a
 * malha é ampliada com suavização e ainda recebe um borrão, então o mapa vai
 * sumindo aos poucos em vez de terminar num recorte duro. O Mestre vê a névoa
 * translúcida (precisa enxergar o que ainda não revelou); o jogador vê fechada.
 */
function FogLayer({
  fog,
  width,
  height,
  isGM,
}: {
  fog: SceneFog
  width: number
  height: number
  isGM: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || width < 1 || height < 1) return
    canvas.width = Math.round(width)
    canvas.height = Math.round(height)
    drawFog(canvas, fog, { alpha: isGM ? 0.5 : 0.97, softness: isGM ? 0.45 : 0.8 })
  }, [fog, width, height, isGM])

  return (
    <canvas
      ref={ref}
      data-fog=""
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      aria-hidden="true"
    />
  )
}

/** Régua: distância em quadrados entre dois pontos do palco. */
function RulerOverlay({
  ruler,
  columns,
  aspect,
}: {
  ruler: { from: Point; to: Point }
  columns: number
  aspect: number
}) {
  const squares = distanceInSquares(ruler.from, ruler.to, columns, aspect)

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1={ruler.from.x * 100}
          y1={ruler.from.y * 100}
          x2={ruler.to.x * 100}
          y2={ruler.to.y * 100}
          stroke="var(--gold-bright)"
          strokeWidth={0.4}
          strokeDasharray="1.6 1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        data-ruler=""
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-[color:var(--gold-dark)] bg-black/80 px-1.5 py-0.5 text-xs text-[color:var(--gold-bright)]"
        style={{ left: `${((ruler.from.x + ruler.to.x) / 2) * 100}%`, top: `${((ruler.from.y + ruler.to.y) / 2) * 100}%` }}
      >
        {squares.toFixed(1)} quadrados
      </span>
    </div>
  )
}

function SceneTokenView({
  token: t,
  width,
  draggable,
  activeTurn = false,
  hiddenFromPlayers = false,
  characters,
  npcs,
  onPointerDown,
}: {
  token: SceneToken
  /** Diâmetro como fração da largura do palco, já na escala do mapa. */
  width: number
  /** Quem está olhando pode arrastar esta peça. */
  draggable: boolean
  /** É a vez desta criatura no combate — a peça acende para a mesa toda. */
  activeTurn?: boolean
  /** Só o Mestre está vendo esta criatura: ela está no escuro para os jogadores. */
  hiddenFromPlayers?: boolean
  characters: Character[]
  npcs: NPC[]
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const status = resolveTokenStatus(t.refType, t.refId, characters, npcs)
  // A peça guarda o nome de quando foi colocada; se a ficha foi renomeada
  // depois, quem manda é o nome de agora.
  const label = status?.name ?? t.label
  // Mesma ideia para a imagem: uma peça colocada antes de a arte oficial
  // existir passa a mostrá-la sem precisar ser recolocada.
  const image = resolveCreaturePortrait(label, t.imageUrl)
  const isBoss = t.kind === 'boss'
  const statusRing =
    status?.tier === 'critical'
      ? 'outline outline-[3px] outline-red-500 outline-offset-2 animate-pulse-ring'
      : status?.tier === 'hurt'
        ? 'outline outline-[3px] outline-amber-400 outline-offset-2'
        : ''

  return (
    <div
      onPointerDown={onPointerDown}
      data-token={label}
      data-active-turn={activeTurn ? '' : undefined}
      className={`group absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-full ${
        isBoss ? 'ring-[5px] animate-boss-glow' : 'ring-2'
      } ${KIND_STYLE[t.kind]} ${statusRing} ${activeTurn ? 'animate-turn-glow z-[7]' : ''} ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${t.onBoard === false ? 'opacity-40' : hiddenFromPlayers ? 'opacity-60' : ''}`}
      style={{
        left: `${t.x * 100}%`,
        top: `${t.y * 100}%`,
        width: `${width * 100}%`,
        aspectRatio: '1 / 1',
      }}
      title={`${label} (${SCENE_TOKEN_LABELS[t.kind]})${activeTurn ? ' — é a vez dele!' : ''}${hiddenFromPlayers ? ' — escondido dos jogadores (escuridão ou névoa)' : ''}${status?.tier === 'hurt' ? ' — avariado' : status?.tier === 'critical' ? ' — crítico' : ''}${status?.conditions.length ? ` · ${status.conditions.join(', ')}` : ''}`}
    >
      {/* Pulso saindo da peça, para achar de quem é a vez num mapa cheio. O nome
          continua só no hover, como nas outras peças. */}
      {activeTurn && (
        <span className="animate-turn-sonar pointer-events-none absolute inset-0 rounded-full border-2 border-[color:var(--gold-bright)]" />
      )}
      {hiddenFromPlayers && (
        <span
          title="Escondido dos jogadores — escuridão ou névoa de guerra"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900/60 bg-slate-100 text-slate-900 shadow"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 5.3A9.6 9.6 0 0 1 12 5.2c5 0 9 4.3 9 6.8 0 .9-.9 2.4-2.4 3.8M6.2 7.5C4 9 3 10.9 3 12c0 2.5 4 6.8 9 6.8 1.5 0 2.9-.4 4.1-1" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        </span>
      )}
      {isBoss && (
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="currentColor"
          className="absolute -top-4 left-1/2 -translate-x-1/2 text-red-500 drop-shadow"
        >
          <path d="M12 2.5l2.35 5.68 6.15.5-4.68 4.02 1.45 5.97L12 15.4l-5.27 3.27 1.45-5.97-4.68-4.02 6.15-.5L12 2.5z" />
        </svg>
      )}
      {image ? (
        <CreatureImage url={image} alt={label} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-center text-[10px] font-semibold text-white/70 transition-colors group-hover:text-white">
          {label.slice(0, 3)}
        </span>
      )}
      {status && status.tier !== 'ok' && (
        <span
          className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-black/40 text-[9px] ${
            status.tier === 'critical' ? 'bg-red-600' : 'bg-amber-500'
          }`}
        >
          {status.tier === 'critical' ? '💀' : '🩸'}
        </span>
      )}
      {status && status.conditions.length > 0 && (
        <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-purple-700 text-[9px]">
          ⚠
        </span>
      )}
      {/* O nome só aparece ao passar o mouse: com a mesa cheia, uma etiqueta
          embaixo de cada peça tampava o mapa mais do que ajudava. */}
      <span className="pointer-events-none absolute -bottom-5 left-1/2 z-[11] -translate-x-1/2 whitespace-nowrap rounded border border-[color:var(--gold-dark)] bg-black/85 px-1.5 text-[10px] text-purple-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}
