import { createPortal } from 'react-dom'
import { MAX_SUPPLY, emptySurvival } from '../types'
import type { Character, SurvivalState, SurvivalTrack } from '../types'
import { consume, minutesLeft, restock, trackRemaining } from '../lib/survival'
import { SupplyPie } from './SurvivalHud'
import type { TrackKey } from './SurvivalHud'
import { Button, Input, SectionTitle } from './ui'

/**
 * Painel do Mestre para fome e sede. Fica num popup porque é coisa de
 * preparação — no meio do jogo o que importa é o HUD, que continua na tela.
 */
export function SurvivalControls({
  survival,
  characters,
  now,
  onChange,
  onClose,
}: {
  survival: SurvivalState | undefined
  characters: Character[]
  now: number
  onChange: (next: SurvivalState) => void
  onClose: () => void
}) {
  const state = survival ?? emptySurvival()

  function patch(next: Partial<SurvivalState>) {
    onChange({ ...state, ...next })
  }
  function patchTrack(key: 'hunger' | 'thirst', next: Partial<SurvivalTrack>) {
    onChange({ ...state, [key]: { ...state[key], ...next } })
  }
  function toggleMember(id: string) {
    const has = state.partyIds.includes(id)
    patch({ partyIds: has ? state.partyIds.filter((x) => x !== id) : [...state.partyIds, id] })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="hud-chamfer my-8 w-full max-w-2xl border border-[color:var(--gold-dark)] bg-[var(--surface-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Fome e Sede do Grupo</SectionTitle>
          <button onClick={onClose} className="text-purple-400 hover:text-purple-100">
            ✕
          </button>
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm text-purple-100">
          <input type="checkbox" checked={state.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          Ligar o controle de fome e sede nesta mesa
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <TrackPanel
            trackKey="food"
            label="Comida"
            track={state.hunger}
            now={now}
            onConsume={() => patchTrack('hunger', consume(state.hunger, now))}
            onRestock={(d) => patchTrack('hunger', restock(state.hunger, d))}
            onInterval={(m) => patchTrack('hunger', { intervalMinutes: m })}
            onReset={() => patchTrack('hunger', { lastAt: now, lastDamageAt: 0 })}
          />
          <TrackPanel
            trackKey="water"
            label="Água"
            track={state.thirst}
            now={now}
            onConsume={() => patchTrack('thirst', consume(state.thirst, now))}
            onRestock={(d) => patchTrack('thirst', restock(state.thirst, d))}
            onInterval={(m) => patchTrack('thirst', { intervalMinutes: m })}
            onReset={() => patchTrack('thirst', { lastAt: now, lastDamageAt: 0 })}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-3 text-sm text-purple-200">
          <span className="uppercase tracking-[0.14em] text-purple-400/60">Privação</span>
          <span>perde</span>
          <Input
            type="number"
            min={0}
            max={20}
            value={state.damagePerTick}
            onChange={(e) => patch({ damagePerTick: Math.max(0, Number(e.target.value)) })}
            style={{ width: '4.5rem' }}
          />
          <span>PV a cada</span>
          <Input
            type="number"
            min={1}
            max={600}
            value={state.damageMinutes}
            onChange={(e) => patch({ damageMinutes: Math.max(1, Number(e.target.value)) })}
            style={{ width: '5rem' }}
          />
          <span>minutos, para cada barra zerada.</span>
        </div>

        <div className="mt-4 border-t border-purple-900/30 pt-3">
          <p className="mb-1 text-xs uppercase tracking-[0.14em] text-purple-400/60">
            Quem está no grupo ({state.partyIds.length})
          </p>
          <p className="mb-2 text-xs text-purple-300/50">
            Só quem estiver marcado ganha as condições de Faminto/Desidratado e perde PV pela privação.
          </p>
          <div className="flex flex-col gap-1">
            {characters.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-sm text-purple-100"
              >
                <input type="checkbox" checked={state.partyIds.includes(c.id)} onChange={() => toggleMember(c.id)} />
                {c.name}
                <span className="text-xs text-purple-300/50">
                  PV {c.hp.current}/{c.hp.max}
                </span>
              </label>
            ))}
            {characters.length === 0 && <p className="text-xs text-purple-400/40">Nenhum personagem nesta mesa ainda.</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <Button className="text-xs" onClick={() => patch({ partyIds: characters.map((c) => c.id) })}>
              Marcar todos
            </Button>
            <Button className="text-xs" onClick={() => patch({ partyIds: [] })}>
              Desmarcar todos
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function TrackPanel({
  trackKey,
  label,
  track,
  now,
  onConsume,
  onRestock,
  onInterval,
  onReset,
}: {
  trackKey: TrackKey
  label: string
  track: SurvivalTrack
  now: number
  onConsume: () => void
  onRestock: (delta: number) => void
  onInterval: (minutes: number) => void
  onReset: () => void
}) {
  const remaining = trackRemaining(track, now)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-3">
      <div className="flex items-center gap-3">
        <SupplyPie track={trackKey} supply={track.supply} size={58} onConsume={track.supply > 0 ? onConsume : undefined} />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-purple-100">{label}</span>
          <span className="text-xs text-purple-300/60">
            {track.supply}/{MAX_SUPPLY} de estoque
          </span>
          <span className={`text-xs ${remaining <= 0 ? 'text-red-300' : 'text-purple-300/50'}`}>
            {remaining <= 0 ? 'barra zerada' : `${minutesLeft(track, now)} min restantes`}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="primary" className="text-xs" disabled={track.supply <= 0} onClick={onConsume}>
          O grupo consumiu
        </Button>
        <Button className="text-xs" onClick={() => onRestock(1)} disabled={track.supply >= MAX_SUPPLY}>
          + estoque
        </Button>
        <Button className="text-xs" onClick={() => onRestock(-1)} disabled={track.supply <= 0}>
          − estoque
        </Button>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-xs text-purple-200">
        dura
        <Input
          type="number"
          min={1}
          max={2880}
          value={track.intervalMinutes}
          onChange={(e) => onInterval(Math.max(1, Number(e.target.value)))}
          style={{ width: '5rem' }}
        />
        minutos
        <button className="text-purple-400 underline hover:text-purple-100" onClick={onReset}>
          encher a barra sem gastar estoque
        </button>
      </label>
    </div>
  )
}
