import { useState } from 'react'
import { Badge, Button, Input, SectionTitle } from '../components/ui'
import { resolveCreaturePortrait } from '../data/creatureArt'
import { normalizeImageUrl } from '../lib/imageUrl'
import {
  EMPTY_MAP,
  MAX_GRID_COLUMNS,
  MAX_MAP_ZOOM,
  MIN_GRID_COLUMNS,
  MIN_MAP_ZOOM,
  mapOffsetLimit,
  squaresForTokenSize,
  tokenSquares,
} from '../lib/sceneGeometry'
import { groupByFolder, openLibraryItem, snapshotOf } from '../lib/sceneLibrary'
import {
  addSceneLibraryItem,
  deleteSceneLibraryItem,
  updateCharacter,
  updateSceneLibraryItem,
} from '../lib/store'
import { CREATURE_SIZES, SCENE_TOKEN_LABELS } from '../types'
import type { Character, NPC, Scene, SceneLibraryItem, SceneMap, SceneToken, SceneTokenKind } from '../types'
import { ImageUrlInput, SceneTokenThumb } from '../components/sceneBits'

/**
 * Os painéis do Mestre na tela de jogo. Abrem acima do palco, um de cada vez,
 * e fecham quando ele termina — o mapa continua ocupando o resto da tela.
 */

export type AddTokenFn = (
  t: Omit<SceneToken, 'id' | 'x' | 'y' | 'size'>,
  opts?: { at?: { x: number; y: number }; onBoard?: boolean; size?: number; squares?: number },
) => void

const KIND_DOT: Record<SceneTokenKind, string> = {
  pc: 'bg-emerald-400',
  npc: 'bg-sky-400',
  monster: 'bg-orange-400',
  boss: 'bg-red-500',
}

const ASPECT_PRESETS: [string, number][] = [
  ['16:9', 16 / 9],
  ['16:10', 16 / 10],
  ['4:3', 4 / 3],
  ['3:2', 3 / 2],
  ['1:1', 1],
  ['3:4', 3 / 4],
]

/** Luz acesa pelo Mestre: dura uma hora, como uma tocha. */
const TORCH_MS = 60 * 60 * 1000

const selectClass = 'rounded border border-purple-900/50 bg-[var(--surface-well)] px-1 py-0.5 text-xs text-purple-50'

function KindSelect({ value, onChange }: { value: SceneTokenKind; onChange: (k: SceneTokenKind) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SceneTokenKind)} className={selectClass}>
      {(Object.keys(SCENE_TOKEN_LABELS) as SceneTokenKind[]).map((k) => (
        <option key={k} value={k}>
          {SCENE_TOKEN_LABELS[k]}
        </option>
      ))}
    </select>
  )
}

/** Mede a imagem para o palco nascer com o formato dela. */
function probeAspect(url: string, cb: (aspect: number | undefined) => void) {
  const img = new Image()
  img.onload = () => {
    const a = img.naturalWidth / img.naturalHeight
    cb(Number.isFinite(a) && a > 0.1 && a < 10 ? Number(a.toFixed(4)) : undefined)
  }
  img.onerror = () => cb(undefined)
  img.src = url
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

/**
 * Imagem, escala e enquadramento. Tudo é gravado na cena, então o que o Mestre
 * ajusta é exatamente o que os jogadores passam a ver.
 *
 * Girar, dar zoom e deslocar levam as peças e a névoa junto (`onAdjustMap`);
 * o ajuste começa quando o Mestre pega o controle e termina quando solta.
 */
export function MapPanel({
  scene,
  map,
  columns,
  aspect,
  areaAspect,
  mapEdit,
  snap,
  onToggleSnap,
  onPatchMap,
  onAdjustMap,
  onBeginAdjust,
  onEndAdjust,
  onPatchScene,
}: {
  scene: Scene
  map: SceneMap
  columns: number
  aspect: number
  /** Proporção da área visível do Mestre — para "ajustar palco à minha tela". */
  areaAspect: number
  mapEdit: boolean
  snap: boolean
  onToggleSnap: () => void
  onPatchMap: (patch: Partial<SceneMap>) => void
  onAdjustMap: (patch: Partial<SceneMap>) => void
  onBeginAdjust: () => void
  onEndAdjust: () => void
  onPatchScene: (patch: Partial<Scene>) => void
}) {
  const [draftUrl, setDraftUrl] = useState('')
  const [touched, setTouched] = useState(false)
  // O campo acompanha o mapa de fato (ex: aberto pela biblioteca), a não ser
  // que o Mestre esteja no meio de uma digitação.
  const mapUrl = touched ? draftUrl : scene.backgroundUrl

  /**
   * Usar um mapa é também decidir o formato do palco: lemos o tamanho natural
   * da imagem e adotamos a proporção dela — senão sobrava tarja preta em volta
   * de qualquer mapa de outro formato. Trocar a imagem é começar outra cena, e
   * o vínculo com a biblioteca cai (senão "Atualizar" gravaria um mapa por cima
   * de outro).
   */
  function applyMap(raw: string) {
    const url = normalizeImageUrl(raw).trim()
    setTouched(false)
    if (!url) {
      onPatchScene({ backgroundUrl: '', fromLibraryId: undefined })
      return
    }
    probeAspect(url, (natural) =>
      onPatchScene({
        backgroundUrl: url,
        fromLibraryId: undefined,
        map: { ...EMPTY_MAP, aspect: natural ?? map.aspect },
      }),
    )
  }

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
    probeAspect(scene.backgroundUrl, (natural) => {
      if (!natural) return
      const turned = Math.abs(Math.round((map.rotation ?? 0) / 90)) % 2 === 1
      onPatchMap({ aspect: Number((turned ? 1 / natural : natural).toFixed(4)), zoom: 1, offsetX: 0, offsetY: 0 })
    })
  }

  const limit = mapOffsetLimit(map)
  // Os controles que movem o terreno marcam o começo e o fim do ajuste.
  const adjustHandlers = {
    onPointerDown: onBeginAdjust,
    onPointerUp: onEndAdjust,
    onPointerCancel: onEndAdjust,
    onKeyDown: onBeginAdjust,
    onKeyUp: onEndAdjust,
    onBlur: onEndAdjust,
  }

  return (
    <div className="flex flex-col gap-2 text-xs text-purple-200" data-map-panel="">
      <SectionTitle>Mapa</SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <ImageUrlInput
          value={mapUrl}
          onChange={(v) => {
            setTouched(true)
            setDraftUrl(v)
          }}
          placeholder="URL da imagem do mapa (aceita link do Google Drive)"
          style={{ width: '20rem' }}
        />
        <Button variant="primary" onClick={() => applyMap(mapUrl)} disabled={!mapUrl.trim()}>
          Usar mapa
        </Button>
        {scene.backgroundUrl && <Button onClick={() => applyMap('')}>Limpar mapa</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-2">
        <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Escala</span>
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
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={Boolean(scene.showGrid)} onChange={(e) => onPatchScene({ showGrid: e.target.checked })} />
          mostrar grade
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={snap} onChange={onToggleSnap} />
          encaixar peças na grade
        </label>
      </div>

      <p className="text-[11px] text-purple-400/60">
        {mapEdit
          ? 'Ferramenta "Ajustar mapa" ligada: arraste o mapa e use a roda do mouse. As peças e a névoa vão junto com o terreno.'
          : 'Dica: a ferramenta "Ajustar mapa", na barra de cima, deixa arrastar e dar zoom direto no mapa.'}
      </p>

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
          {...adjustHandlers}
          onChange={(e) => onAdjustMap({ rotation: Number(e.target.value) })}
          className="w-40"
          data-map-control="rotation"
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
          {...adjustHandlers}
          onChange={(e) => onAdjustMap({ zoom: Number(e.target.value) / 100 })}
          className="w-40"
          data-map-control="zoom"
        />
        <span className="w-14 tabular-nums">{Math.round((map.zoom ?? 1) * 100)}%</span>
        <select value={map.fit ?? 'contain'} onChange={(e) => onPatchMap({ fit: e.target.value as 'contain' | 'cover' })} className={selectClass}>
          <option value="contain">Imagem inteira</option>
          <option value="cover">Preencher (recorta as bordas)</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Posição</span>
        {/* O alcance cresce com o zoom: com o mapa ampliado, o controle
            precisa chegar até a borda dele. */}
        <label className="flex items-center gap-1">
          X
          <input
            type="range"
            min={-limit * 100}
            max={limit * 100}
            value={Math.round((map.offsetX ?? 0) * 100)}
            {...adjustHandlers}
            onChange={(e) => onAdjustMap({ offsetX: Number(e.target.value) / 100 })}
            className="w-32"
            data-map-control="offsetX"
          />
        </label>
        <label className="flex items-center gap-1">
          Y
          <input
            type="range"
            min={-limit * 100}
            max={limit * 100}
            value={Math.round((map.offsetY ?? 0) * 100)}
            {...adjustHandlers}
            onChange={(e) => onAdjustMap({ offsetY: Number(e.target.value) / 100 })}
            className="w-32"
            data-map-control="offsetY"
          />
        </label>
        <Button className="text-xs" onClick={() => onAdjustMap({ offsetX: 0, offsetY: 0 })}>
          Centralizar
        </Button>
        <Button className="text-xs" onClick={() => onAdjustMap({ rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 })}>
          Desfazer ajustes
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 uppercase tracking-[0.14em] text-purple-400/60">Recorte</span>
        <span className="text-purple-300/60">proporção {aspect.toFixed(2)}:1 — o palco é a área que os jogadores enxergam</span>
        <Button className="text-xs" onClick={fitStageToImage} disabled={!scene.backgroundUrl}>
          Usar a proporção da imagem
        </Button>
        <Button
          className="text-xs"
          title="O palco fica com o formato da sua área de mapa — sem sobra nas bordas na sua tela"
          onClick={() => onPatchMap({ aspect: Number(areaAspect.toFixed(4)) })}
        >
          Ajustar palco à minha tela
        </Button>
        {ASPECT_PRESETS.map(([label, value]) => (
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

export function PiecesPanel({
  tableId,
  gmUid,
  scene,
  columns,
  characters,
  npcs,
  now,
  onAddToken,
  onUpdateToken,
  onPutOnBoard,
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
  now: number
  onAddToken: AddTokenFn
  onUpdateToken: (id: string, patch: Partial<SceneToken>) => void
  onPutOnBoard: (id: string) => void
  onRemoveToken: (id: string) => void
  onClear: () => void
}) {
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenUrl, setTokenUrl] = useState('')
  const [tokenKind, setTokenKind] = useState<SceneTokenKind>('monster')
  const [saved, setSaved] = useState('')

  const staged = scene.tokens.filter((t) => t.onBoard === false)
  const onBoard = scene.tokens.filter((t) => t.onBoard !== false)
  const players = characters.filter((c) => c.ownerUid !== gmUid)

  function addLoose(onBoardNow: boolean) {
    onAddToken({ label: tokenLabel.trim(), imageUrl: normalizeImageUrl(tokenUrl) || undefined, kind: tokenKind }, { onBoard: onBoardNow })
    setTokenLabel('')
    setTokenUrl('')
  }

  return (
    <div className="flex flex-col gap-3 text-xs text-purple-200" data-pieces-panel="">
      <div className="flex flex-wrap items-center gap-1.5">
        <SectionTitle>Peças</SectionTitle>
        <span className="text-purple-400/60">"+" põe direto no mapa, numa casa livre · 🎭 prepara na bandeja</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {characters.map((c) => {
          const kind: SceneTokenKind = c.ownerUid === gmUid ? 'npc' : 'pc'
          const token = { label: c.name, imageUrl: c.portraitUrl, kind, refType: 'character' as const, refId: c.id }
          return (
            <span key={c.id} className="flex items-center gap-0.5">
              <button
                data-add-token={c.name}
                onClick={() => onAddToken(token)}
                className={`rounded-full border px-2 py-0.5 ${
                  kind === 'npc'
                    ? 'border-sky-800/50 text-sky-200 hover:border-sky-500'
                    : 'border-emerald-800/50 text-emerald-200 hover:border-emerald-500'
                }`}
              >
                + {c.name}
              </button>
              <button
                title="Preparar na bandeja em vez de colocar direto no mapa"
                onClick={() => onAddToken(token, { onBoard: false })}
                className="rounded-full border border-purple-800/30 px-1.5 py-0.5 text-purple-300/70 hover:border-purple-500"
              >
                🎭
              </button>
            </span>
          )
        })}
        {npcs.map((n) => {
          const token = {
            label: n.name,
            imageUrl: resolveCreaturePortrait(n.name, n.portraitUrl),
            kind: 'monster' as const,
            refType: 'npc' as const,
            refId: n.id,
          }
          const squares = squaresForTokenSize(n.tokenSize)
          return (
            <span key={n.id} className="flex items-center gap-0.5">
              <button
                data-add-token={n.name}
                onClick={() => onAddToken(token, { squares })}
                className="rounded-full border border-orange-800/50 px-2 py-0.5 text-orange-200 hover:border-orange-500"
              >
                + {n.name}
              </button>
              <button
                title="Preparar na bandeja em vez de colocar direto no mapa"
                onClick={() => onAddToken(token, { onBoard: false, squares })}
                className="rounded-full border border-orange-800/30 px-1.5 py-0.5 text-orange-300/70 hover:border-orange-500"
              >
                🎭
              </button>
            </span>
          )
        })}
        {characters.length === 0 && npcs.length === 0 && <span className="text-purple-400/50">Nenhuma ficha na mesa ainda.</span>}
      </div>

      {players.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-purple-900/30 pt-2">
          <span className="uppercase tracking-[0.14em] text-purple-400/60">Luz</span>
          {players.map((c) => {
            const lit = Boolean(c.lightUntil && c.lightUntil > now)
            return (
              <button
                key={c.id}
                data-torch={c.name}
                title={lit ? 'Apagar a luz deste personagem' : 'Acender uma luz para este personagem (1 hora)'}
                onClick={() => void updateCharacter(tableId, c.id, { lightUntil: lit ? 0 : Date.now() + TORCH_MS })}
                className={`rounded-full border px-2 py-0.5 ${
                  lit ? 'border-amber-500/70 bg-amber-900/30 text-amber-200' : 'border-purple-800/50 text-purple-300/70 hover:border-amber-500'
                }`}
              >
                {lit ? '🔥' : '·'} {c.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-2">
        <Input value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} placeholder="Nome do ícone" style={{ width: '10rem' }} />
        <ImageUrlInput value={tokenUrl} onChange={setTokenUrl} placeholder="URL da imagem (opcional, aceita link do Google Drive)" style={{ width: '14rem' }} />
        <KindSelect value={tokenKind} onChange={setTokenKind} />
        <Button variant="primary" disabled={!tokenLabel.trim()} onClick={() => addLoose(true)}>
          + Adicionar ao mapa
        </Button>
        <Button disabled={!tokenLabel.trim()} title="Fica escondido numa bandeja até você colocar no mapa" onClick={() => addLoose(false)}>
          🎭 Preparar (bandeja)
        </Button>
        <Button
          disabled={!tokenLabel.trim()}
          title="Guarda este ícone na biblioteca da mesa, para usar em outras sessões"
          onClick={async () => {
            await addSceneLibraryItem(tableId, {
              kind: 'token',
              label: tokenLabel.trim(),
              imageUrl: normalizeImageUrl(tokenUrl) || undefined,
              tokenKind,
              createdAt: Date.now(),
            })
            setSaved(tokenLabel.trim())
            setTimeout(() => setSaved(''), 3000)
          }}
        >
          💾 Guardar na biblioteca
        </Button>
        {saved && <span className="text-emerald-300">"{saved}" guardado.</span>}
      </div>

      {staged.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-purple-900/30 pt-2" data-tray="">
          <p className="uppercase tracking-[0.14em] text-purple-400/60">
            🎭 Bandeja — escondidas dos jogadores até você colocar no mapa
          </p>
          <div className="flex flex-wrap gap-2">
            {staged.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-2">
                <SceneTokenThumb token={t} />
                <span className="text-sm text-purple-100">{t.label}</span>
                <KindSelect value={t.kind} onChange={(k) => onUpdateToken(t.id, { kind: k })} />
                <Button variant="primary" onClick={() => onPutOnBoard(t.id)} className="text-xs">
                  Colocar no mapa
                </Button>
                <button className="text-red-400 hover:text-red-200" onClick={() => onRemoveToken(t.id)}>
                  remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {onBoard.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-purple-900/30 pt-2" data-board-list="">
          <div className="flex items-center justify-between">
            <p className="uppercase tracking-[0.14em] text-purple-400/60">No mapa</p>
            <Button variant="danger" className="px-2 py-0.5 text-[11px]" onClick={onClear}>
              Remover todas
            </Button>
          </div>
          {onBoard.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <span className="w-32 truncate">{t.label}</span>
              <KindSelect value={t.kind} onChange={(k) => onUpdateToken(t.id, { kind: k })} />
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
              <button
                className="text-purple-300 hover:text-purple-100"
                title="Tira do mapa e devolve para a bandeja"
                onClick={() => onUpdateToken(t.id, { onBoard: false })}
              >
                recolher
              </button>
              <button className="text-red-400 hover:text-red-200" onClick={() => onRemoveToken(t.id)}>
                remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

/**
 * Cenas e ícones guardados na mesa, para reaproveitar entre sessões.
 *
 * Guardar uma cena guarda a cena INTEIRA — imagem, enquadramento, grade, luz,
 * névoa, peças e som. A cena aberta a partir da biblioteca pode ser gravada
 * por cima, para mexer num encontro preparado sem acumular cópias dele.
 */
export function LibraryPanel({
  tableId,
  scene,
  library,
  onOpen,
  onAddToken,
}: {
  tableId: string
  scene: Scene
  library: SceneLibraryItem[]
  onOpen: (next: Scene) => void
  onAddToken: AddTokenFn
}) {
  const [label, setLabel] = useState('')
  const [folder, setFolder] = useState('')
  const [notice, setNotice] = useState('')

  const scenes = library.filter((i) => i.kind === 'map')
  const tokenPresets = library.filter((i) => i.kind === 'token')
  const openItem = scenes.find((i) => i.id === scene.fromLibraryId)
  const folders = Array.from(new Set(scenes.map((i) => i.folder?.trim()).filter(Boolean))) as string[]

  function tell(text: string) {
    setNotice(text)
    setTimeout(() => setNotice(''), 3500)
  }

  async function saveNew() {
    const item = await addSceneLibraryItem(tableId, {
      kind: 'map',
      label: label.trim(),
      imageUrl: scene.backgroundUrl,
      folder: folder.trim() || undefined,
      snapshot: snapshotOf(scene),
      createdAt: Date.now(),
    })
    // A cena em jogo passa a ser a guardada: o próximo ajuste já pode gravar
    // por cima dela.
    onOpen({ ...scene, fromLibraryId: item.id })
    tell(`"${item.label}" guardada.`)
    setLabel('')
  }

  async function saveOver(item: SceneLibraryItem) {
    await updateSceneLibraryItem(tableId, item.id, {
      imageUrl: scene.backgroundUrl,
      snapshot: snapshotOf(scene),
      updatedAt: Date.now(),
    })
    tell(`"${item.label}" atualizada.`)
  }

  return (
    <div className="flex flex-col gap-3 text-xs text-purple-200" data-library-panel="">
      <SectionTitle>Biblioteca da Mesa</SectionTitle>

      <div className="flex flex-col gap-1.5 rounded border border-purple-900/40 bg-black/20 p-2">
        <p className="text-purple-300/70">
          Guardar a cena guarda tudo — mapa, enquadramento, grade, luz, névoa, peças e o som que está tocando. Monte o
          encontro antes da sessão e abra na hora.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {openItem && (
            <Button variant="primary" onClick={() => saveOver(openItem)} title={`Grava por cima de "${openItem.label}", sem criar outra entrada`}>
              💾 Atualizar "{openItem.label}"
            </Button>
          )}
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da cena" style={{ width: '10rem' }} className="text-xs" />
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Pasta (opcional)"
            style={{ width: '8rem' }} className="text-xs"
            list="scene-folders"
          />
          <datalist id="scene-folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <Button disabled={!label.trim() || (!scene.backgroundUrl && scene.tokens.length === 0)} onClick={saveNew}>
            {openItem ? 'Guardar como nova' : 'Guardar cena'}
          </Button>
          {notice && <span className="text-emerald-300">{notice}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 uppercase tracking-[0.14em] text-purple-400/60">Cenas e mapas</p>
          <div className="flex flex-col gap-2">
            {groupByFolder(scenes).map(([name, items]) => (
              <div key={name}>
                <p className="mb-0.5 text-[10px] uppercase tracking-wide text-purple-400/50">📁 {name}</p>
                <div className="flex flex-col gap-1">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      data-library-item={m.label}
                      className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${
                        m.id === scene.fromLibraryId ? 'border-[color:var(--gold)]/70 bg-[color:var(--gold)]/10' : 'border-purple-900/30 bg-black/20'
                      }`}
                    >
                      <button
                        className="flex min-w-0 items-center gap-1.5 truncate text-left text-purple-100 hover:text-purple-300"
                        title={m.snapshot ? 'Abre a cena inteira, como foi guardada' : 'Item antigo: troca só a imagem do mapa'}
                        onClick={() => onOpen(openLibraryItem(scene, m))}
                      >
                        🗺️ <span className="truncate">{m.label}</span>
                      </button>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {m.id === scene.fromLibraryId ? (
                          <Badge tone="good">aberta</Badge>
                        ) : (
                          <span className="text-[10px] text-purple-400/50">{m.snapshot ? 'cena completa' : 'só o mapa'}</span>
                        )}
                        <button
                          className="text-red-400 hover:text-red-200"
                          onClick={() => {
                            if (window.confirm(`Apagar "${m.label}" da biblioteca?`)) void deleteSceneLibraryItem(tableId, m.id)
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {scenes.length === 0 && <p className="text-purple-400/40">Nenhuma cena guardada ainda.</p>}
          </div>
        </div>

        <div>
          <p className="mb-1 uppercase tracking-[0.14em] text-purple-400/60">Monstros/ícones salvos</p>
          <div className="flex flex-col gap-1">
            {tokenPresets.map((t) => {
              const kind = t.tokenKind ?? 'monster'
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1">
                  <button
                    className="flex min-w-0 items-center gap-1.5 truncate text-left text-purple-100 hover:text-purple-300"
                    onClick={() => onAddToken({ label: t.label, imageUrl: t.imageUrl, kind })}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-sm ${KIND_DOT[kind]}`} />
                    <span className="truncate">{t.label}</span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1">
                    <KindSelect value={kind} onChange={(k) => updateSceneLibraryItem(tableId, t.id, { tokenKind: k })} />
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
            {tokenPresets.length === 0 && (
              <p className="text-purple-400/40">Nenhum ícone salvo — crie um em "Peças" e use "Guardar na biblioteca".</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
