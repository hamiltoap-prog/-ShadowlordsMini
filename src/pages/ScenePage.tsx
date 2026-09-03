import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { newId } from '../lib/id'
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
} from '../lib/store'
import { SCENE_TOKEN_LABELS } from '../types'
import type { Character, GameTable, NPC, Scene, SceneLibraryItem, SceneToken, SceneTokenKind } from '../types'

const KIND_STYLE: Record<SceneTokenKind, string> = {
  pc: 'ring-emerald-400 bg-emerald-900/60',
  npc: 'ring-sky-400 bg-sky-900/60',
  monster: 'ring-orange-400 bg-orange-900/60',
  boss: 'ring-red-500 bg-red-900/70',
}

const EMPTY_SCENE: Scene = { backgroundUrl: '', tokens: [], revealed: false, updatedAt: 0 }
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
  const boardRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const localEdit = useRef(false)
  const panDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const scene = sceneState ?? EMPTY_SCENE

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

  const persist = useCallback(
    (next: Scene) => {
      setSceneState(next)
      void saveScene(tableId, next).catch((err) => console.error('Erro ao salvar a cena', err))
    },
    [tableId],
  )

  function addToken(token: Omit<SceneToken, 'id' | 'x' | 'y' | 'size'>, opts?: { at?: { x: number; y: number }; onBoard?: boolean }) {
    const newToken: SceneToken = {
      ...token,
      id: newId(),
      x: opts?.at?.x ?? 0.5,
      y: opts?.at?.y ?? 0.5,
      size: token.kind === 'boss' ? 0.17 : 0.07,
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

  // Arrastar tokens (só o Mestre) — a posição relativa já leva em conta o
  // zoom/pan atual, porque o retângulo do board reflete a tela renderizada.
  useEffect(() => {
    if (!dragId || !isGM) return
    function onMove(e: PointerEvent) {
      localEdit.current = true
      const pos = pointerToRelative(e.clientX, e.clientY)
      setSceneState((s) => {
        const base = s ?? EMPTY_SCENE
        return { ...base, tokens: base.tokens.map((t) => (t.id === dragId ? { ...t, ...pos } : t)) }
      })
    }
    function onUp(e: PointerEvent) {
      const pos = pointerToRelative(e.clientX, e.clientY)
      setSceneState((s) => {
        const base = s ?? EMPTY_SCENE
        const next = { ...base, tokens: base.tokens.map((t) => (t.id === dragId ? { ...t, ...pos } : t)) }
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
  }, [dragId, isGM, tableId])

  // Zoom com a roda do mouse (todo mundo pode, é só a visão de cada um).
  // Precisa ser um listener nativo não-passivo para poder cancelar o scroll da página.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
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
    panDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
  }
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!panDrag.current) return
      const { startX, startY, panX, panY } = panDrag.current
      setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) })
    }
    function onUp() {
      panDrag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  /** Aceita imagens arrastadas de outra aba/página (URL) direto no tabuleiro. */
  function onDrop(e: React.DragEvent) {
    if (!isGM) return
    e.preventDefault()
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || ''
    if (!url.trim()) return
    const pos = pointerToRelative(e.clientX, e.clientY)
    // Segurando Shift, a imagem vira o mapa de fundo em vez de um ícone.
    if (e.shiftKey) persist({ ...scene, backgroundUrl: url.trim() })
    else addToken({ label: 'Novo ícone', imageUrl: url.trim(), kind: 'monster' }, { at: pos })
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
  const visibleTokens = scene.tokens.filter((t) => isGM || t.onBoard !== false)
  const stagedTokens = scene.tokens.filter((t) => t.onBoard === false)

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl text-purple-100">Tela de Jogo — {table.name}</h1>
          <p className="text-xs text-purple-300/50">
            {isGM
              ? 'Arraste imagens (Shift = vira o mapa de fundo). Role o mouse para zoom, arraste o fundo para navegar.'
              : 'Role o mouse para zoom e arraste o fundo para navegar — isso é só da sua tela.'}
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

      {showWaitingScreen ? (
        <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-purple-900/50 bg-[var(--surface-board)] text-center">
          <span className="text-4xl">🕯️</span>
          <p className="text-purple-200">O Mestre está preparando a cena...</p>
          <p className="text-xs text-purple-400/50">A tela vai aparecer automaticamente assim que ele revelar.</p>
        </div>
      ) : (
        <div
          ref={viewportRef}
          onPointerDown={onViewportPointerDown}
          onDrop={onDrop}
          onDragOver={(e) => isGM && e.preventDefault()}
          className="relative min-h-[60vh] flex-1 cursor-grab overflow-hidden rounded-xl border border-purple-900/50 bg-[var(--surface-board)] active:cursor-grabbing"
        >
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

          <div
            ref={boardRef}
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              backgroundImage: scene.backgroundUrl ? `url(${scene.backgroundUrl})` : undefined,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {!scene.backgroundUrl && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-purple-400/40">
                {isGM ? 'Solte a imagem do mapa aqui (com Shift) ou use a biblioteca abaixo.' : 'O Mestre ainda não abriu um mapa.'}
              </p>
            )}

            {visibleTokens.map((t) => (
              <SceneTokenView
                key={t.id}
                token={t}
                isGM={isGM}
                characters={characters}
                npcs={npcs}
                onPointerDown={(e) => {
                  if (!isGM) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDragId(t.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {isGM && stagedTokens.length > 0 && (
        <Card className="flex flex-col gap-2 p-3">
          <SectionTitle>🎭 Bandeja de Monstros Preparados</SectionTitle>
          <p className="text-xs text-purple-300/50">
            Ficam escondidos dos jogadores até você colocar no mapa — ótimo para uma emboscada surpresa.
          </p>
          <div className="flex flex-wrap gap-2">
            {stagedTokens.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-2">
                <SceneTokenThumb token={t} />
                <span className="text-sm text-purple-100">{t.label}</span>
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
          scene={scene}
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
  isGM,
  characters,
  npcs,
  onPointerDown,
}: {
  token: SceneToken
  isGM: boolean
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
      className={`absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-full ${
        isBoss ? 'ring-[5px] animate-boss-glow' : 'ring-2'
      } ${KIND_STYLE[t.kind]} ${statusRing} ${isGM ? 'cursor-grab active:cursor-grabbing' : ''} ${
        t.onBoard === false ? 'opacity-40' : ''
      }`}
      style={{
        left: `${t.x * 100}%`,
        top: `${t.y * 100}%`,
        width: `${t.size * 100}%`,
        aspectRatio: '1 / 1',
      }}
      title={`${t.label} (${SCENE_TOKEN_LABELS[t.kind]})${status?.tier === 'hurt' ? ' — avariado' : status?.tier === 'critical' ? ' — crítico' : ''}${status?.conditions.length ? ` · ${status.conditions.join(', ')}` : ''}`}
    >
      {isBoss && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg drop-shadow">👑</span>}
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
  scene,
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
  scene: Scene
  characters: Character[]
  npcs: NPC[]
  library: SceneLibraryItem[]
  onSetBackground: (url: string) => void
  onAddToken: (t: Omit<SceneToken, 'id' | 'x' | 'y' | 'size'>, opts?: { at?: { x: number; y: number }; onBoard?: boolean }) => void
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
          <Input value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="URL do mapa de fundo" className="w-72" />
          <Button variant="primary" onClick={() => onSetBackground(bgUrl.trim())}>
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
          <Input value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} placeholder="URL da imagem (opcional)" className="w-56" />
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
              onAddToken({ label: tokenLabel.trim(), imageUrl: tokenUrl.trim() || undefined, kind: tokenKind })
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
              onAddToken({ label: tokenLabel.trim(), imageUrl: tokenUrl.trim() || undefined, kind: tokenKind }, { onBoard: false })
              setTokenLabel('')
              setTokenUrl('')
            }}
          >
            🎭 Preparar (bandeja)
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-purple-900/30 pt-2">
          <span className="text-xs uppercase text-purple-400/60">Adicionar rápido:</span>
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => onAddToken({ label: c.name, imageUrl: c.portraitUrl, kind: 'pc', refType: 'character', refId: c.id })}
              className="rounded-full border border-emerald-800/50 px-2 py-0.5 text-xs text-emerald-200 hover:border-emerald-500"
            >
              + {c.name}
            </button>
          ))}
          {npcs.map((n) => (
            <span key={n.id} className="flex items-center gap-0.5">
              <button
                onClick={() => onAddToken({ label: n.name, imageUrl: n.portraitUrl, kind: 'monster', refType: 'npc', refId: n.id })}
                className="rounded-full border border-orange-800/50 px-2 py-0.5 text-xs text-orange-200 hover:border-orange-500"
              >
                + {n.name}
              </button>
              <button
                title="Preparar na bandeja em vez de colocar direto no mapa"
                onClick={() =>
                  onAddToken({ label: n.name, imageUrl: n.portraitUrl, kind: 'monster', refType: 'npc', refId: n.id }, { onBoard: false })
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
                <label className="flex items-center gap-1">
                  tamanho
                  <input
                    type="range"
                    min={3}
                    max={30}
                    value={Math.round(t.size * 100)}
                    onChange={(e) => onUpdateToken(t.id, { size: Number(e.target.value) / 100 })}
                  />
                </label>
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
                    imageUrl: bgUrl.trim(),
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
              {tokenPresets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-xs">
                  <button
                    className="truncate text-left text-purple-100 hover:text-purple-300"
                    onClick={() => onAddToken({ label: t.label, imageUrl: t.imageUrl, kind: t.tokenKind ?? 'monster' })}
                  >
                    {t.tokenKind === 'boss' ? '👑' : t.tokenKind === 'npc' ? '🙂' : '👹'} {t.label}
                  </button>
                  <span className="flex items-center gap-1">
                    <button
                      title="Preparar na bandeja"
                      className="text-purple-400 hover:text-purple-200"
                      onClick={() => onAddToken({ label: t.label, imageUrl: t.imageUrl, kind: t.tokenKind ?? 'monster' }, { onBoard: false })}
                    >
                      🎭
                    </button>
                    <button className="text-red-400 hover:text-red-200" onClick={() => deleteSceneLibraryItem(tableId, t.id)}>
                      ✕
                    </button>
                  </span>
                </div>
              ))}
              {tokenPresets.length === 0 && <p className="text-xs text-purple-400/40">Nenhum ícone salvo ainda.</p>}
            </div>
            <Button
              className="mt-2"
              disabled={!tokenLabel.trim()}
              onClick={async () => {
                await addSceneLibraryItem(tableId, {
                  kind: 'token',
                  label: tokenLabel.trim(),
                  imageUrl: tokenUrl.trim() || undefined,
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
