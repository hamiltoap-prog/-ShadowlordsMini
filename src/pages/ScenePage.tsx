import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { newId } from '../lib/id'
import { normalizeImageUrl } from '../lib/imageUrl'
import {
  EMPTY_MAP,
  MAX_GRID_COLUMNS,
  MAX_MAP_ZOOM,
  MIN_GRID_COLUMNS,
  MIN_MAP_ZOOM,
  fitStage,
  gridColumns as sceneGridColumns,
  mapTransform,
  snapToGrid,
  squaresForTokenSize,
  stageAspect,
  tokenSquares,
  tokenWidth,
} from '../lib/sceneGeometry'
import { resolveTokenStatus } from '../lib/tokenStatus'
import {
  addSceneLibraryItem,
  deleteSceneLibraryItem,
  listenCharacters,
  listenNPCs,
  listenScene,
  listenSceneLibrary,
  listenTable,
  saveScene,
  updateSceneLibraryItem,
} from '../lib/store'
import { CREATURE_SIZES, SCENE_TOKEN_LABELS } from '../types'
import type {
  Character,
  GameTable,
  NPC,
  Scene,
  SceneLibraryItem,
  SceneMap,
  SceneToken,
  SceneTokenKind,
  TimeOfDay,
} from '../types'

const STAR_POSITIONS = [
  [8, 12], [17, 6], [23, 22], [34, 9], [41, 18], [52, 5], [61, 14], [69, 24],
  [77, 8], [85, 19], [91, 11], [14, 32], [29, 30], [47, 28], [64, 33], [80, 30],
  [6, 40], [37, 40], [58, 42], [95, 38],
] as const

const KIND_STYLE: Record<SceneTokenKind, string> = {
  pc: 'ring-emerald-400 bg-emerald-900/60',
  npc: 'ring-sky-400 bg-sky-900/60',
  monster: 'ring-orange-400 bg-orange-900/60',
  boss: 'ring-red-500 bg-red-900/70',
}

const KIND_DOT: Record<SceneTokenKind, string> = {
  pc: 'bg-emerald-400',
  npc: 'bg-sky-400',
  monster: 'bg-orange-400',
  boss: 'bg-red-500',
}

const EMPTY_SCENE: Scene = { backgroundUrl: '', tokens: [], revealed: false, updatedAt: 0 }

/** Escuridão do local sem luz: forte o bastante para pesar, fraca o bastante
 * para o grupo continuar enxergando o mapa e as peças. */
const DARKNESS_ALPHA = 0.5
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
const NO_FOLDER = '(Sem pasta)'

/**
 * Tela de jogo compartilhada: o Mestre monta o mapa e move os ícones,
 * os jogadores acompanham em tempo real (somente leitura), com zoom próprio.
 * Enquanto o Mestre não "revela" a cena, os jogadores veem uma tela de espera
 * — e o Firestore de fato nega a leitura para eles nesse meio-tempo. Tokens
 * "preparados" (onBoard=false) ficam numa bandeja só do Mestre até serem
 * colocados no mapa, mesmo com a cena já revelada.
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
  const [dragId, setDragId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  /** Tamanho em pixels do palco nesta tela — o palco em si é igual para todos,
   *  só a quantidade de pixels muda de monitor para monitor. */
  const [stage, setStage] = useState({ width: 0, height: 0 })
  /** Modo de ajuste do mapa (só o Mestre): arrastar e a roda passam a mexer na
   *  imagem de fundo em vez de na lente de quem está olhando. */
  const [mapEdit, setMapEdit] = useState(false)
  const [snap, setSnap] = useState(true)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const boardRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const localEdit = useRef(false)
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const mapDrag = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)
  const aspectProbed = useRef('')
  // O listener da roda é nativo e não é recriado a cada render; estas refs dão
  // a ele acesso ao estado atual sem precisar reanexá-lo o tempo todo.
  const mapEditRef = useRef(false)
  const sceneRef = useRef<Scene>(EMPTY_SCENE)
  const persistRef = useRef<(next: Scene) => void>(() => {})

  const scene = sceneState ?? EMPTY_SCENE
  const timeOfDay: TimeOfDay = scene.timeOfDay ?? 'day'
  const locationLit = scene.locationLit ?? true
  const map: SceneMap = { ...EMPTY_MAP, ...scene.map }
  const aspect = stageAspect(scene)
  const lightRy = LIGHT_RX * aspect
  const columns = sceneGridColumns(scene)
  const rows = Math.max(1, Math.round(columns / aspect))

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
    return listenScene(tableId, (s) => {
      // Evita que a posição remota "pule" enquanto estamos arrastando aqui.
      if (localEdit.current) return
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
  // disponível. Medir aqui (em vez de deixar para o CSS) é o que garante que
  // 0..1 signifique o mesmo ponto do mapa na tela do Mestre e na de cada
  // jogador. A janela é medida só na largura, e a altura dela passa a seguir o
  // palco — assim uma tela alta e estreita não fica com um vazio enorme em
  // cima e embaixo do mapa.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    function measure() {
      const width = el!.getBoundingClientRect().width
      const maxHeight = Math.max(320, window.innerHeight * 0.74)
      setStage(fitStage(width, maxHeight, aspect))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [aspect, sceneState, table])

  useEffect(() => {
    mapEditRef.current = isGM && mapEdit
  }, [isGM, mapEdit])

  const persist = useCallback(
    (next: Scene) => {
      setSceneState(next)
      void saveScene(tableId, next).catch((err) => console.error('Erro ao salvar a cena', err))
    },
    [tableId],
  )

  useEffect(() => {
    sceneRef.current = sceneState ?? EMPTY_SCENE
    persistRef.current = persist
  })

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
      persist({ ...scene, map: { ...scene.map, aspect: img.naturalWidth / img.naturalHeight } })
    }
    img.src = scene.backgroundUrl
  }, [isGM, scene, persist])

  function patchMap(patch: Partial<SceneMap>) {
    persist({ ...scene, map: { ...map, ...patch } })
  }

  function toggleTimeOfDay() {
    const next: TimeOfDay = timeOfDay === 'day' ? 'night' : 'day'
    persist({ ...scene, timeOfDay: next, locationLit: next === 'day' })
    setAnnouncement(next === 'night' ? 'A noite cai sobre as Terras Sombrias...' : 'O dia amanhece, cinzento e avermelhado...')
    setTimeout(() => setAnnouncement(null), 3200)
  }

  function toggleLocationLit() {
    persist({ ...scene, locationLit: !locationLit })
  }

  function addToken(
    token: Omit<SceneToken, 'id' | 'x' | 'y' | 'size'>,
    opts?: { at?: { x: number; y: number }; onBoard?: boolean; size?: number; squares?: number },
  ) {
    // O tamanho vem em quadrados: a peça já nasce na escala do mapa atual, e
    // continua proporcional às outras se o Mestre mudar a escala depois.
    const squares = opts?.squares ?? (opts?.size ? squaresForTokenSize(opts.size) : token.kind === 'boss' ? 2 : 1)
    const newToken: SceneToken = {
      ...token,
      id: newId(),
      x: opts?.at?.x ?? 0.5,
      y: opts?.at?.y ?? 0.5,
      squares,
      size: Math.min(1, squares / columns),
      onBoard: opts?.onBoard ?? true,
    }
    persist({ ...scene, tokens: [...scene.tokens, newToken] })
  }

  function updateToken(id: string, patch: Partial<SceneToken>) {
    persist({ ...scene, tokens: scene.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  }

  function removeToken(id: string) {
    persist({ ...scene, tokens: scene.tokens.filter((t) => t.id !== id) })
  }

  function pointerToRelative(clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0.5, y: 0.5 }
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  // Arrastar peças (só o Mestre) — a posição é sempre relativa ao palco, então
  // o mesmo arraste cai no mesmo ponto do mapa em qualquer tela.
  useEffect(() => {
    if (!dragId || !isGM) return
    function place(base: Scene, clientX: number, clientY: number) {
      const raw = pointerToRelative(clientX, clientY)
      return {
        ...base,
        tokens: base.tokens.map((t) => {
          if (t.id !== dragId) return t
          const pos = snap ? snapToGrid(raw.x, raw.y, tokenSquares(t, columns), columns, aspect) : raw
          return { ...t, ...pos }
        }),
      }
    }
    function onMove(e: PointerEvent) {
      localEdit.current = true
      setSceneState((s) => place(s ?? EMPTY_SCENE, e.clientX, e.clientY))
    }
    function onUp(e: PointerEvent) {
      setSceneState((s) => {
        const next = place(s ?? EMPTY_SCENE, e.clientX, e.clientY)
        void saveScene(tableId, next).finally(() => {
          localEdit.current = false
        })
        return next
      })
      setDragId(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragId, isGM, tableId, snap, columns, aspect])

  // Zoom com a roda do mouse (todo mundo pode, é só a visão de cada um).
  // Precisa ser um listener nativo não-passivo para poder cancelar o scroll da página.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (mapEditRef.current) {
        // Ajustando o mapa: a roda muda o zoom da *imagem* dentro do palco.
        const current = sceneRef.current
        const base: SceneMap = { ...EMPTY_MAP, ...current.map }
        const next = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, (base.zoom ?? 1) - e.deltaY * 0.0015))
        persistRef.current({ ...current, map: { ...base, zoom: Number(next.toFixed(3)) } })
        return
      }
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // Reanexa sempre que a div do tabuleiro pode ter sido remontada
    // (ex: saindo/entrando da tela de espera).
  }, [sceneState, isGM, table])

  // Arrastar o fundo para "andar" pelo mapa (pan). Ignorado se o pointerdown
  // começou em cima de um token (que já usa stopPropagation).
  function onViewportPointerDown(e: React.PointerEvent) {
    if (isGM && mapEdit) {
      mapDrag.current = { startX: e.clientX, startY: e.clientY, offsetX: map.offsetX ?? 0, offsetY: map.offsetY ?? 0 }
      return
    }
    panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (mapDrag.current) {
        // Move a imagem dentro do palco. Divide pelo tamanho do palco (e pelo
        // zoom da lente) para o mapa acompanhar o cursor na proporção certa.
        const { startX, startY, offsetX, offsetY } = mapDrag.current
        const w = stage.width * zoom || 1
        const h = stage.height * zoom || 1
        const current = sceneRef.current
        persistRef.current({
          ...current,
          map: {
            ...EMPTY_MAP,
            ...current.map,
            offsetX: Number((offsetX + (e.clientX - startX) / w).toFixed(4)),
            offsetY: Number((offsetY + (e.clientY - startY) / h).toFixed(4)),
          },
        })
        return
      }
      if (!panDrag.current) return
      const { startX, startY, panX, panY } = panDrag.current
      setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) })
    }
    function onUp() {
      panDrag.current = null
      mapDrag.current = null
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
    // Segurando Shift, a imagem vira o mapa de fundo em vez de um ícone.
    if (e.shiftKey) persist({ ...scene, backgroundUrl: url })
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
  // Jogadores nunca veem tokens ainda "preparados" na bandeja do Mestre.
  const boardTokens = scene.tokens.filter((t) => t.onBoard !== false)
  const stagedTokens = scene.tokens.filter((t) => t.onBoard === false)

  // Sem luz no local: escurece o mapa inteiro, com "furos" de luz ao redor de
  // cada personagem com uma fonte de iluminação ativa (lightUntil no futuro).
  const litTokens = boardTokens.filter((t) => {
    if (t.refType !== 'character') return false
    const c = characters.find((x) => x.id === t.refId)
    return Boolean(c?.lightUntil && c.lightUntil > now)
  })

  /**
   * No escuro, monstros e chefes fora do alcance de qualquer luz somem da tela
   * dos jogadores — o Mestre continua vendo, marcados como ocultos. Personagens
   * e NPCs seguem visíveis: o grupo sabe onde os seus estão.
   */
  function hiddenInTheDark(t: SceneToken) {
    if (locationLit) return false
    if (t.kind !== 'monster' && t.kind !== 'boss') return false
    return !litTokens.some((l) => {
      const dx = (t.x - l.x) / (LIGHT_RX * LIGHT_REVEAL)
      const dy = (t.y - l.y) / (lightRy * LIGHT_REVEAL)
      return dx * dx + dy * dy <= 1
    })
  }

  const visibleTokens = isGM ? scene.tokens : boardTokens.filter((t) => !hiddenInTheDark(t))
  // A escuridão deixa o mapa sombrio, mas nunca cega: ainda dá para enxergar o
  // cenário e as peças fora do alcance da luz — só com bem menos nitidez.
  // As camadas ficam sempre montadas e só mudam de opacidade, para a escuridão
  // entrar e sair junto com a transição do céu em vez de aparecer de estalo.
  const darkEllipse = `${(LIGHT_RX * 100).toFixed(2)}% ${(lightRy * 100).toFixed(2)}%`
  const glowEllipse = `${(LIGHT_RX * GLOW_SCALE * 100).toFixed(2)}% ${(lightRy * GLOW_SCALE * 100).toFixed(2)}%`
  const darknessBackground = [
    ...litTokens.map(
      (t) =>
        `radial-gradient(ellipse ${darkEllipse} at ${t.x * 100}% ${t.y * 100}%, rgba(3,4,12,0) 0%, rgba(3,4,12,0) ${LIGHT_CLEAR * 100}%, rgba(3,4,12,0.3) 74%, rgba(3,4,12,${DARKNESS_ALPHA}) 100%)`,
    ),
    `linear-gradient(rgba(3,4,12,${DARKNESS_ALPHA}), rgba(3,4,12,${DARKNESS_ALPHA}))`,
  ].join(', ')

  // Camada aditiva (blend "screen"): a tocha realmente clareia o que está por
  // perto, em vez de apenas "furar" a escuridão.
  const lightGlowBackground = litTokens
    .map(
      (t) =>
        `radial-gradient(ellipse ${glowEllipse} at ${t.x * 100}% ${t.y * 100}%, rgba(255,205,135,0.62) 0%, rgba(255,182,96,0.4) 35%, rgba(120,70,20,0.12) 70%, rgba(0,0,0,0) 100%)`,
    )
    .join(', ')

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl text-purple-100">Tela de Jogo — {table.name}</h1>
          <p className="text-xs text-purple-300/50">
            {isGM
              ? 'Arraste imagens (Shift = vira o mapa de fundo). Arraste as peças para movê-las; a roda dá zoom na sua tela. Use "Ajustar mapa" para enquadrar o cenário.'
              : 'Você vê exatamente o enquadramento do Mestre. A roda do mouse e o arraste são só a sua lente — não movem nada para os outros.'}
          </p>
        </div>
        {isGM && (
          <Button
            variant={scene.revealed ? 'danger' : 'primary'}
            onClick={() => persist({ ...scene, revealed: !scene.revealed })}
          >
            {scene.revealed ? '🙈 Ocultar (tela de espera)' : '👁 Revelar aos jogadores'}
          </Button>
        )}
        {!isGM && (
          <Badge tone={showWaitingScreen ? 'bad' : 'good'}>{showWaitingScreen ? 'aguardando o Mestre' : 'ao vivo'}</Badge>
        )}
      </div>

      {!showWaitingScreen && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{timeOfDay === 'day' ? '🌇 Dia' : '🌑 Noite'}</Badge>
          <Badge tone={locationLit ? 'good' : 'bad'}>{locationLit ? '💡 Local iluminado' : '🌑 Sem luz — precisa de iluminação'}</Badge>
          {isGM && (
            <>
              <Button onClick={toggleTimeOfDay} className="text-xs">
                {timeOfDay === 'day' ? '🌙 Anoitecer' : '🌇 Amanhecer'}
              </Button>
              <Button onClick={toggleLocationLit} className="text-xs">
                {locationLit ? 'Escurecer local (ambiente fechado)' : 'Iluminar local'}
              </Button>
            </>
          )}
        </div>
      )}

      {isGM && !showWaitingScreen && (
        <MapFrameControls
          scene={scene}
          map={map}
          columns={columns}
          aspect={aspect}
          mapEdit={mapEdit}
          snap={snap}
          onToggleMapEdit={() => setMapEdit((v) => !v)}
          onToggleSnap={() => setSnap((v) => !v)}
          onPatchMap={patchMap}
          onPatchScene={(patch) => persist({ ...scene, ...patch })}
        />
      )}

      {showWaitingScreen ? (
        <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-purple-900/50 bg-[var(--surface-board)] text-center">
          <span className="text-4xl">🕯️</span>
          <p className="text-purple-200">O Mestre está preparando a cena...</p>
          <p className="text-xs text-purple-400/50">A tela vai aparecer automaticamente assim que ele revelar.</p>
        </div>
      ) : (
        <div ref={wrapRef} className="w-full">
        <div
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          onDrop={onDrop}
          onDragOver={(e) => isGM && e.preventDefault()}
          style={{ height: stage.height || undefined }}
          className="relative min-h-[280px] cursor-grab overflow-hidden rounded-xl border border-purple-900/50 bg-[var(--surface-board)] active:cursor-grabbing"
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

          <div className="pointer-events-none absolute right-2 top-2 z-10 flex gap-1">
            <button
              className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-sm text-purple-100 hover:bg-black/80"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))}
            >
              +
            </button>
            <button
              className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-sm text-purple-100 hover:bg-black/80"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))}
            >
              −
            </button>
            <button
              className="pointer-events-auto rounded bg-black/60 px-2 py-1 text-xs text-purple-100 hover:bg-black/80"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
            >
              reset
            </button>
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
                  src={scene.backgroundUrl}
                  alt=""
                  data-map=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none"
                  style={{ objectFit: map.fit ?? 'contain', transform: mapTransform(map), transformOrigin: 'center center' }}
                />
              ) : (
                <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-purple-400/40">
                  {isGM ? 'Solte a imagem do mapa aqui (com Shift) ou use a biblioteca abaixo.' : 'O Mestre ainda não abriu um mapa.'}
                </p>
              )}

              {scene.showGrid && (
                <div
                  data-grid=""
                  className="pointer-events-none absolute inset-0 z-[2]"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(200,170,110,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(200,170,110,0.28) 1px, transparent 1px)',
                    backgroundSize: `${100 / columns}% ${100 / rows}%`,
                  }}
                />
              )}

              {visibleTokens.map((t) => (
                <SceneTokenView
                  key={t.id}
                  token={t}
                  width={tokenWidth(t, columns)}
                  isGM={isGM}
                  hiddenFromPlayers={isGM && hiddenInTheDark(t)}
                  characters={characters}
                  npcs={npcs}
                  onPointerDown={(e) => {
                    if (!isGM || mapEdit) return
                    e.preventDefault()
                    e.stopPropagation()
                    setDragId(t.id)
                  }}
                />
              ))}

              <div
                className="pointer-events-none absolute inset-0 z-[3] transition-opacity duration-[2000ms] ease-in-out"
                style={{ backgroundImage: darknessBackground, opacity: locationLit ? 0 : 1 }}
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

              {isGM && mapEdit && (
                <div className="pointer-events-none absolute inset-0 z-[7] border-2 border-dashed border-[color:var(--gold)]/70" />
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {isGM && stagedTokens.length > 0 && (
        <Card className="flex flex-col gap-2 p-3">
          <SectionTitle>🎭 Bandeja de Criaturas Preparadas</SectionTitle>
          <p className="text-xs text-purple-300/50">
            Ficam escondidas dos jogadores até você colocar no mapa — ótimo para uma emboscada surpresa. Ajuste o
            tipo de cada uma antes de colocar.
          </p>
          <div className="flex flex-wrap gap-2">
            {stagedTokens.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-2">
                <SceneTokenThumb token={t} />
                <span className="text-sm text-purple-100">{t.label}</span>
                <select
                  value={t.kind}
                  onChange={(e) => updateToken(t.id, { kind: e.target.value as SceneTokenKind })}
                  className="rounded border border-purple-900/50 bg-[var(--surface-well)] px-1 py-0.5 text-xs text-purple-50"
                >
                  {(Object.keys(SCENE_TOKEN_LABELS) as SceneTokenKind[]).map((k) => (
                    <option key={k} value={k}>
                      {SCENE_TOKEN_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  onClick={() => updateToken(t.id, { onBoard: true, x: 0.5, y: 0.5 })}
                  className="text-xs"
                >
                  Colocar no mapa
                </Button>
                <button className="text-xs text-red-400 hover:text-red-200" onClick={() => removeToken(t.id)}>
                  remover
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isGM && (
        <SceneControls
          tableId={tableId}
          gmUid={table.gmUid}
          scene={scene}
          columns={columns}
          characters={characters}
          npcs={npcs}
          library={library}
          onSetBackground={(url) => persist({ ...scene, backgroundUrl: url })}
          onAddToken={addToken}
          onUpdateToken={updateToken}
          onRemoveToken={removeToken}
          onClear={() => persist({ ...scene, tokens: [] })}
        />
      )}
    </div>
  )
}

/**
 * Controles de enquadramento e escala do mapa (só o Mestre).
 *
 * Tudo aqui é gravado na cena, então o que o Mestre ajusta é exatamente o que
 * os jogadores passam a ver — inclusive a proporção do palco, que é o recorte.
 */
function MapFrameControls({
  scene,
  map,
  columns,
  aspect,
  mapEdit,
  snap,
  onToggleMapEdit,
  onToggleSnap,
  onPatchMap,
  onPatchScene,
}: {
  scene: Scene
  map: SceneMap
  columns: number
  aspect: number
  mapEdit: boolean
  snap: boolean
  onToggleMapEdit: () => void
  onToggleSnap: () => void
  onPatchMap: (patch: Partial<SceneMap>) => void
  onPatchScene: (patch: Partial<Scene>) => void
}) {
  const [open, setOpen] = useState(false)

  /**
   * Um quarto de volta gira a imagem e vira o palco junto — sem isso o mapa
   * deitado sobraria para fora de um palco que continuou em pé.
   */
  function quarterTurn(delta: number) {
    onPatchMap({ rotation: ((map.rotation ?? 0) + delta + 360) % 360, aspect: Number((1 / aspect).toFixed(4)) })
  }

  /** Deixa o palco com a proporção da imagem, já contando a rotação. */
  function fitStageToImage() {
    if (!scene.backgroundUrl) return
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return
      const quarterTurn = Math.abs(Math.round((map.rotation ?? 0) / 90)) % 2 === 1
      const natural = img.naturalWidth / img.naturalHeight
      onPatchMap({ aspect: Number((quarterTurn ? 1 / natural : natural).toFixed(4)), zoom: 1, offsetX: 0, offsetY: 0 })
    }
    img.src = scene.backgroundUrl
  }

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionTitle>Mapa</SectionTitle>
        <Button
          variant={mapEdit ? 'primary' : 'secondary'}
          onClick={onToggleMapEdit}
          className="text-xs"
          title="Enquanto ligado, arrastar move o mapa e a roda dá zoom nele"
        >
          {mapEdit ? '🖐 Ajustando o mapa — clique para sair' : '🖐 Ajustar mapa'}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-purple-200">
          <input type="checkbox" checked={Boolean(scene.showGrid)} onChange={(e) => onPatchScene({ showGrid: e.target.checked })} />
          Mostrar grade
        </label>
        <label className="flex items-center gap-1.5 text-xs text-purple-200">
          <input type="checkbox" checked={snap} onChange={onToggleSnap} />
          Encaixar peças na grade
        </label>
        <button className="text-xs text-purple-400 hover:text-purple-100" onClick={() => setOpen((v) => !v)}>
          {open ? 'esconder ajustes ▲' : 'mais ajustes ▼'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-purple-200">
        <span className="uppercase tracking-[0.14em] text-purple-400/60">Escala</span>
        <input
          type="range"
          min={MIN_GRID_COLUMNS}
          max={MAX_GRID_COLUMNS}
          value={columns}
          onChange={(e) => onPatchScene({ gridColumns: Number(e.target.value) })}
          className="w-40"
        />
        <Input
          type="number"
          min={MIN_GRID_COLUMNS}
          max={MAX_GRID_COLUMNS}
          value={columns}
          onChange={(e) => onPatchScene({ gridColumns: Number(e.target.value) })}
          style={{ width: '4.5rem' }}
        />
        <span className="text-purple-300/60">quadrados de largura — quanto maior o mapa, menores ficam as peças</span>
      </div>

      {mapEdit && (
        <p className="text-xs text-[color:var(--gold)]">
          Arraste o mapa para reposicionar e use a roda do mouse para aproximar. As peças ficam travadas enquanto isso.
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2 text-xs text-purple-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Girar</span>
            <Button className="text-xs" onClick={() => quarterTurn(-90)}>
              ⟲ 90°
            </Button>
            <Button className="text-xs" onClick={() => quarterTurn(90)}>
              ⟳ 90°
            </Button>
            <input
              type="range"
              min={-180}
              max={180}
              value={map.rotation ?? 0}
              onChange={(e) => onPatchMap({ rotation: Number(e.target.value) })}
              className="w-40"
            />
            <span className="w-12 tabular-nums">{Math.round(map.rotation ?? 0)}°</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Tamanho</span>
            <input
              type="range"
              min={MIN_MAP_ZOOM * 100}
              max={MAX_MAP_ZOOM * 100}
              value={Math.round((map.zoom ?? 1) * 100)}
              onChange={(e) => onPatchMap({ zoom: Number(e.target.value) / 100 })}
              className="w-40"
            />
            <span className="w-14 tabular-nums">{Math.round((map.zoom ?? 1) * 100)}%</span>
            <select
              value={map.fit ?? 'contain'}
              onChange={(e) => onPatchMap({ fit: e.target.value as 'contain' | 'cover' })}
              className="rounded border border-purple-900/50 bg-[var(--surface-well)] px-1.5 py-1 text-xs text-purple-50"
            >
              <option value="contain">Imagem inteira</option>
              <option value="cover">Preencher (recorta as bordas)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Recorte</span>
            <span className="text-purple-300/60">
              proporção {aspect.toFixed(2)}:1 — o palco é a área que os jogadores enxergam
            </span>
            <Button className="text-xs" onClick={fitStageToImage} disabled={!scene.backgroundUrl}>
              Usar a proporção da imagem
            </Button>
            {(
              [
                ['16:9', 16 / 9],
                ['4:3', 4 / 3],
                ['1:1', 1],
                ['3:4', 3 / 4],
              ] as [string, number][]
            ).map(([label, value]) => (
              <button
                key={label}
                onClick={() => onPatchMap({ aspect: value })}
                className={`rounded-full border px-2 py-0.5 ${
                  Math.abs(aspect - value) < 0.01
                    ? 'border-[color:var(--gold)] text-[color:var(--gold-bright)]'
                    : 'border-purple-800/50 text-purple-300/70 hover:border-purple-500'
                }`}
              >
                {label}
              </button>
            ))}
            <input
              type="range"
              min={50}
              max={250}
              value={Math.round(aspect * 100)}
              onChange={(e) => onPatchMap({ aspect: Number(e.target.value) / 100 })}
              className="w-32"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Posição</span>
            <span className="tabular-nums text-purple-300/60">
              x {((map.offsetX ?? 0) * 100).toFixed(0)}% · y {((map.offsetY ?? 0) * 100).toFixed(0)}%
            </span>
            <Button className="text-xs" onClick={() => onPatchMap({ offsetX: 0, offsetY: 0 })}>
              Centralizar
            </Button>
            <Button
              className="text-xs"
              onClick={() => onPatchMap({ rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, fit: 'contain' })}
            >
              Desfazer todos os ajustes
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function SceneTokenThumb({ token }: { token: SceneToken }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ${KIND_STYLE[token.kind]}`}
    >
      {token.imageUrl ? (
        <img src={token.imageUrl} alt={token.label} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] font-semibold text-white">{token.label.slice(0, 4)}</span>
      )}
    </div>
  )
}

function SceneTokenView({
  token: t,
  width,
  isGM,
  hiddenFromPlayers = false,
  characters,
  npcs,
  onPointerDown,
}: {
  token: SceneToken
  /** Diâmetro como fração da largura do palco, já na escala do mapa. */
  width: number
  isGM: boolean
  /** Só o Mestre está vendo esta criatura: ela está no escuro para os jogadores. */
  hiddenFromPlayers?: boolean
  characters: Character[]
  npcs: NPC[]
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const status = resolveTokenStatus(t.refType, t.refId, characters, npcs)
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
      data-token={t.label}
      className={`absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-full ${
        isBoss ? 'ring-[5px] animate-boss-glow' : 'ring-2'
      } ${KIND_STYLE[t.kind]} ${statusRing} ${isGM ? 'cursor-grab active:cursor-grabbing' : ''} ${
        t.onBoard === false ? 'opacity-40' : hiddenFromPlayers ? 'opacity-60' : ''
      }`}
      style={{
        left: `${t.x * 100}%`,
        top: `${t.y * 100}%`,
        width: `${width * 100}%`,
        aspectRatio: '1 / 1',
      }}
      title={`${t.label} (${SCENE_TOKEN_LABELS[t.kind]})${hiddenFromPlayers ? ' — no escuro: os jogadores não veem' : ''}${status?.tier === 'hurt' ? ' — avariado' : status?.tier === 'critical' ? ' — crítico' : ''}${status?.conditions.length ? ` · ${status.conditions.join(', ')}` : ''}`}
    >
      {hiddenFromPlayers && (
        <span
          title="No escuro — os jogadores não veem esta criatura"
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
      {t.imageUrl ? (
        <img src={t.imageUrl} alt={t.label} className="h-full w-full rounded-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-center text-[10px] font-semibold text-white">
          {t.label.slice(0, 8)}
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
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1 text-[10px] text-purple-100">
        {t.label}
      </span>
    </div>
  )
}

function SceneControls({
  tableId,
  gmUid,
  scene,
  columns,
  characters,
  npcs,
  library,
  onSetBackground,
  onAddToken,
  onUpdateToken,
  onRemoveToken,
  onClear,
}: {
  tableId: string
  gmUid: string
  scene: Scene
  /** Escala atual do mapa, em quadrados de largura. */
  columns: number
  characters: Character[]
  npcs: NPC[]
  library: SceneLibraryItem[]
  onSetBackground: (url: string) => void
  onAddToken: (
    t: Omit<SceneToken, 'id' | 'x' | 'y' | 'size'>,
    opts?: { at?: { x: number; y: number }; onBoard?: boolean; size?: number; squares?: number },
  ) => void
  onUpdateToken: (id: string, patch: Partial<SceneToken>) => void
  onRemoveToken: (id: string) => void
  onClear: () => void
}) {
  const [bgUrl, setBgUrl] = useState(scene.backgroundUrl)
  const [bgLabel, setBgLabel] = useState('')
  const [bgFolder, setBgFolder] = useState('')
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenUrl, setTokenUrl] = useState('')
  const [tokenKind, setTokenKind] = useState<SceneTokenKind>('monster')

  const maps = library.filter((i) => i.kind === 'map')
  const tokenPresets = library.filter((i) => i.kind === 'token')

  const mapsByFolder = useMemo(() => {
    const groups: Record<string, SceneLibraryItem[]> = {}
    for (const m of maps) {
      const key = m.folder?.trim() || NO_FOLDER
      groups[key] = groups[key] ?? []
      groups[key].push(m)
    }
    return Object.entries(groups).sort(([a], [b]) => (a === NO_FOLDER ? 1 : b === NO_FOLDER ? -1 : a.localeCompare(b)))
  }, [maps])

  return (
    <>
      <Card className="flex flex-col gap-3 p-3">
        <SectionTitle>Controles do Mestre</SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={bgUrl}
            onChange={(e) => setBgUrl(e.target.value)}
            onBlur={() => setBgUrl((u) => normalizeImageUrl(u))}
            placeholder="URL do mapa de fundo (aceita link do Google Drive)"
            className="w-72"
          />
          <Button variant="primary" onClick={() => onSetBackground(normalizeImageUrl(bgUrl))}>
            Definir mapa
          </Button>
          <Button
            onClick={() => {
              setBgUrl('')
              onSetBackground('')
            }}
          >
            Limpar mapa
          </Button>
          <Button variant="danger" onClick={onClear}>
            Remover todos os ícones
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-2">
          <Input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} placeholder="Nome do ícone" className="w-40" />
          <Input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            onBlur={() => setTokenUrl((u) => normalizeImageUrl(u))}
            placeholder="URL da imagem (opcional, aceita link do Google Drive)"
            className="w-56"
          />
          <select
            value={tokenKind}
            onChange={(e) => setTokenKind(e.target.value as SceneTokenKind)}
            className="rounded-lg border border-purple-900/50 bg-[var(--surface-well)] px-2 py-1.5 text-sm text-purple-50"
          >
            {(Object.keys(SCENE_TOKEN_LABELS) as SceneTokenKind[]).map((k) => (
              <option key={k} value={k}>
                {SCENE_TOKEN_LABELS[k]}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            disabled={!tokenLabel.trim()}
            onClick={() => {
              onAddToken({ label: tokenLabel.trim(), imageUrl: normalizeImageUrl(tokenUrl) || undefined, kind: tokenKind })
              setTokenLabel('')
              setTokenUrl('')
            }}
          >
            + Adicionar ao mapa
          </Button>
          <Button
            disabled={!tokenLabel.trim()}
            title="Fica escondido numa bandeja até você colocar no mapa"
            onClick={() => {
              onAddToken({ label: tokenLabel.trim(), imageUrl: normalizeImageUrl(tokenUrl) || undefined, kind: tokenKind }, { onBoard: false })
              setTokenLabel('')
              setTokenUrl('')
            }}
          >
            🎭 Preparar (bandeja)
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-purple-900/30 pt-2">
          <span className="text-xs uppercase text-purple-400/60">Adicionar rápido:</span>
          {characters.map((c) => {
            const kind: SceneTokenKind = c.ownerUid === gmUid ? 'npc' : 'pc'
            return (
              <span key={c.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => onAddToken({ label: c.name, imageUrl: c.portraitUrl, kind, refType: 'character', refId: c.id })}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    kind === 'npc'
                      ? 'border-sky-800/50 text-sky-200 hover:border-sky-500'
                      : 'border-emerald-800/50 text-emerald-200 hover:border-emerald-500'
                  }`}
                >
                  + {c.name}
                </button>
                <button
                  title="Preparar na bandeja em vez de colocar direto no mapa"
                  onClick={() =>
                    onAddToken({ label: c.name, imageUrl: c.portraitUrl, kind, refType: 'character', refId: c.id }, { onBoard: false })
                  }
                  className="rounded-full border border-purple-800/30 px-1.5 py-0.5 text-xs text-purple-300/70 hover:border-purple-500"
                >
                  🎭
                </button>
              </span>
            )
          })}
          {npcs.map((n) => (
            <span key={n.id} className="flex items-center gap-0.5">
              <button
                onClick={() =>
                  onAddToken(
                    { label: n.name, imageUrl: n.portraitUrl, kind: 'monster', refType: 'npc', refId: n.id },
                    { squares: squaresForTokenSize(n.tokenSize) },
                  )
                }
                className="rounded-full border border-orange-800/50 px-2 py-0.5 text-xs text-orange-200 hover:border-orange-500"
              >
                + {n.name}
              </button>
              <button
                title="Preparar na bandeja em vez de colocar direto no mapa"
                onClick={() =>
                  onAddToken(
                    { label: n.name, imageUrl: n.portraitUrl, kind: 'monster', refType: 'npc', refId: n.id },
                    { onBoard: false, squares: squaresForTokenSize(n.tokenSize) },
                  )
                }
                className="rounded-full border border-orange-800/30 px-1.5 py-0.5 text-xs text-orange-300/70 hover:border-orange-500"
              >
                🎭
              </button>
            </span>
          ))}
        </div>

        {scene.tokens.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-purple-900/30 pt-2">
            {scene.tokens.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs text-purple-200">
                <span className="w-32 truncate">
                  {t.label} {t.onBoard === false && <span className="text-purple-400/50">(na bandeja)</span>}
                </span>
                <select
                  value={t.kind}
                  onChange={(e) => onUpdateToken(t.id, { kind: e.target.value as SceneTokenKind })}
                  className="rounded border border-purple-900/50 bg-[var(--surface-well)] px-1 py-0.5 text-xs"
                >
                  {(Object.keys(SCENE_TOKEN_LABELS) as SceneTokenKind[]).map((k) => (
                    <option key={k} value={k}>
                      {SCENE_TOKEN_LABELS[k]}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1" title="Tamanho em quadrados da grade">
                  quadrados
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={tokenSquares(t, columns)}
                    onChange={(e) => onUpdateToken(t.id, { squares: Math.max(0.5, Number(e.target.value)) })}
                    className="w-14 rounded border border-purple-900/50 bg-[var(--surface-well)] px-1 py-0.5 text-xs text-purple-50"
                  />
                </label>
                <span className="flex gap-1">
                  {CREATURE_SIZES.map((c) => (
                    <button
                      key={c.key}
                      title={`${c.label} — ${c.squares} quadrado${c.squares > 1 ? 's' : ''}`}
                      onClick={() => onUpdateToken(t.id, { squares: c.squares })}
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                        tokenSquares(t, columns) === c.squares
                          ? 'border-[color:var(--gold)] text-[color:var(--gold-bright)]'
                          : 'border-purple-800/50 text-purple-300/60 hover:border-purple-500'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </span>
                <button className="text-red-400 hover:text-red-200" onClick={() => onRemoveToken(t.id)}>
                  remover
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-3">
        <SectionTitle>Biblioteca da Mesa</SectionTitle>
        <p className="text-xs text-purple-300/50">
          Prepare mapas e monstros com antecedência e reutilize entre sessões — ficam salvos nesta mesa.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase text-purple-400/60">Mapas salvos</p>
            <div className="flex flex-col gap-2">
              {mapsByFolder.map(([folder, items]) => (
                <div key={folder}>
                  <p className="mb-0.5 text-[10px] uppercase tracking-wide text-purple-400/50">📁 {folder}</p>
                  <div className="flex flex-col gap-1">
                    {items.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-xs">
                        <button className="truncate text-left text-purple-100 hover:text-purple-300" onClick={() => onSetBackground(m.imageUrl ?? '')}>
                          🗺️ {m.label}
                        </button>
                        <button className="text-red-400 hover:text-red-200" onClick={() => deleteSceneLibraryItem(tableId, m.id)}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {maps.length === 0 && <p className="text-xs text-purple-400/40">Nenhum mapa salvo ainda.</p>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Input value={bgLabel} onChange={(e) => setBgLabel(e.target.value)} placeholder="Nome do mapa" className="w-32 text-xs" />
              <Input value={bgFolder} onChange={(e) => setBgFolder(e.target.value)} placeholder="Pasta (opcional)" className="w-28 text-xs" />
              <Button
                disabled={!bgUrl.trim() || !bgLabel.trim()}
                onClick={async () => {
                  await addSceneLibraryItem(tableId, {
                    kind: 'map',
                    label: bgLabel.trim(),
                    imageUrl: normalizeImageUrl(bgUrl),
                    folder: bgFolder.trim() || undefined,
                    createdAt: Date.now(),
                  })
                  setBgLabel('')
                  setBgFolder('')
                }}
              >
                Salvar
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase text-purple-400/60">Monstros/ícones salvos</p>
            <div className="flex flex-col gap-1">
              {tokenPresets.map((t) => {
                const kind = t.tokenKind ?? 'monster'
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-xs">
                    <button
                      className="flex min-w-0 items-center gap-1.5 truncate text-left text-purple-100 hover:text-purple-300"
                      onClick={() => onAddToken({ label: t.label, imageUrl: t.imageUrl, kind })}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-sm ${KIND_DOT[kind]}`} />
                      <span className="truncate">{t.label}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-1">
                      <select
                        value={kind}
                        onChange={(e) => updateSceneLibraryItem(tableId, t.id, { tokenKind: e.target.value as SceneTokenKind })}
                        className="rounded border border-purple-900/50 bg-[var(--surface-well)] px-1 py-0.5 text-[11px] text-purple-50"
                      >
                        {(Object.keys(SCENE_TOKEN_LABELS) as SceneTokenKind[]).map((k) => (
                          <option key={k} value={k}>
                            {SCENE_TOKEN_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      <button
                        title="Preparar na bandeja"
                        className="text-purple-400 hover:text-purple-200"
                        onClick={() => onAddToken({ label: t.label, imageUrl: t.imageUrl, kind }, { onBoard: false })}
                      >
                        🎭
                      </button>
                      <button className="text-red-400 hover:text-red-200" onClick={() => deleteSceneLibraryItem(tableId, t.id)}>
                        ✕
                      </button>
                    </span>
                  </div>
                )
              })}
              {tokenPresets.length === 0 && <p className="text-xs text-purple-400/40">Nenhum ícone salvo ainda.</p>}
            </div>
            <Button
              className="mt-2"
              disabled={!tokenLabel.trim()}
              onClick={async () => {
                await addSceneLibraryItem(tableId, {
                  kind: 'token',
                  label: tokenLabel.trim(),
                  imageUrl: normalizeImageUrl(tokenUrl) || undefined,
                  tokenKind,
                  createdAt: Date.now(),
                })
              }}
            >
              Salvar o ícone preenchido acima
            </Button>
          </div>
        </div>
      </Card>
    </>
  )
}
