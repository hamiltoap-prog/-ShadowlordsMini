import { MAX_SUPPLY } from '../types'
import type { SurvivalState, SurvivalTrack } from '../types'
import { minutesLeft, trackRemaining } from '../lib/survival'

/**
 * Painel fixo de fome e sede na tela de jogo — no espírito de HUD de jogo:
 * pequeno, sempre visível, sem atrapalhar o mapa. Os dois círculos são o
 * suprimento do grupo (quartos de comida e de água) e as barras ao lado
 * mostram há quanto tempo estão sem comer ou beber.
 */

const TRACKS = {
  food: { label: 'Comida', icon: '🍖', color: '#d9a441', empty: '#3a2a12' },
  water: { label: 'Água', icon: '💧', color: '#4bb7d9', empty: '#0f2b36' },
} as const

export type TrackKey = keyof typeof TRACKS

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const a0 = ((startDeg - 90) * Math.PI) / 180
  const a1 = ((endDeg - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`
}

/** Gráfico de pizza com os quartos de suprimento. Clicável só para o Mestre. */
export function SupplyPie({
  track,
  supply,
  size = 44,
  onConsume,
}: {
  track: TrackKey
  supply: number
  size?: number
  onConsume?: () => void
}) {
  const style = TRACKS[track]
  const r = size / 2 - 2
  const c = size / 2
  const interactive = Boolean(onConsume)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={interactive ? 'cursor-pointer' : ''}
      onClick={onConsume}
      role={interactive ? 'button' : 'img'}
      aria-label={`${style.label}: ${supply} de ${MAX_SUPPLY}`}
    >
      <title>
        {style.label}: {supply}/{MAX_SUPPLY}
        {interactive ? ' — clique para gastar um quarto (o grupo consumiu)' : ''}
      </title>
      {Array.from({ length: MAX_SUPPLY }, (_, i) => (
        <path
          key={i}
          d={wedgePath(c, c, r, i * (360 / MAX_SUPPLY), (i + 1) * (360 / MAX_SUPPLY))}
          fill={i < supply ? style.color : style.empty}
          stroke="rgba(3,5,12,0.75)"
          strokeWidth={1.5}
        />
      ))}
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(200,170,110,0.5)" strokeWidth={1.5} />
    </svg>
  )
}

function TrackRow({
  track,
  data,
  now,
  onConsume,
  compact,
}: {
  track: TrackKey
  data: SurvivalTrack
  now: number
  onConsume?: () => void
  compact?: boolean
}) {
  const style = TRACKS[track]
  const remaining = trackRemaining(data, now)
  const empty = remaining <= 0
  const left = minutesLeft(data, now)
  return (
    <div className="flex items-center gap-2">
      <SupplyPie track={track} supply={data.supply} size={compact ? 38 : 46} onConsume={onConsume} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-purple-300/70">
          {style.icon} {style.label}
          {data.supply === 0 && <span className="text-red-400">· sem estoque</span>}
        </span>
        <div className={`h-2 ${compact ? 'w-28' : 'w-40'} overflow-hidden rounded-full bg-black/60 ring-1 ring-black/40`}>
          <div
            className={`h-full transition-[width] duration-700 ${empty ? 'animate-pulse-ring' : ''}`}
            style={{ width: `${Math.max(empty ? 100 : 2, remaining * 100)}%`, backgroundColor: empty ? '#b91c1c' : style.color }}
          />
        </div>
        <span className={`text-[10px] ${empty ? 'text-red-300' : 'text-purple-300/50'}`}>
          {empty ? (track === 'food' ? 'faminto — perdendo PV' : 'desidratado — perdendo PV') : `${left} min`}
        </span>
      </div>
    </div>
  )
}

export function SurvivalHud({
  survival,
  now,
  isGM,
  partySize,
  onConsume,
}: {
  survival: SurvivalState
  now: number
  isGM: boolean
  partySize: number
  onConsume?: (track: TrackKey) => void
}) {
  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-[color:var(--gold-dark)] bg-black/70 p-2.5 backdrop-blur-sm">
      <span className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--gold)]">
        Provisões do grupo
        <span className="text-purple-300/50">{partySize} no grupo</span>
      </span>
      <TrackRow track="food" data={survival.hunger} now={now} compact onConsume={isGM ? () => onConsume?.('food') : undefined} />
      <TrackRow track="water" data={survival.thirst} now={now} compact onConsume={isGM ? () => onConsume?.('water') : undefined} />
    </div>
  )
}
