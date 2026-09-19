import { useEffect, useRef, useState } from 'react'
import { listenLog, listenSecretRolls } from '../lib/store'
import type { LogEntry } from '../types'
import { DieFace } from './DieFace'

interface ShownRoll {
  id: string
  dice: number[]
  sides: number
  label: string
  summary: string
  actorName: string
  secret: boolean
  success?: boolean
}

/**
 * Mostra a animação de dados para todos na mesa sempre que uma rolagem nova
 * chega pelo Firestore. Rolagens secretas só aparecem para o Mestre.
 */
export function DiceOverlay({ tableId, isGM }: { tableId: string; isGM: boolean }) {
  const [current, setCurrent] = useState<ShownRoll | null>(null)
  const [rolling, setRolling] = useState(true)
  const [tick, setTick] = useState(0)
  const seen = useRef<Set<string>>(new Set())
  const mountedAt = useRef(Date.now())
  const queue = useRef<ShownRoll[]>([])

  useEffect(() => {
    function handleEntries(entries: LogEntry[], secret: boolean) {
      for (const e of [...entries].reverse()) {
        if (!e.dice || e.dice.length === 0) continue
        if (seen.current.has(e.id)) continue
        seen.current.add(e.id)
        // Ignora o que já estava no log antes de abrir a tela
        if (e.ts < mountedAt.current - 3000) continue
        queue.current.push({
          id: e.id,
          dice: e.dice,
          sides: e.diceSides ?? 6,
          label: e.diceLabel || e.kind,
          summary: e.summary,
          actorName: e.actorName,
          secret,
          success: e.success,
        })
      }
      setCurrent((c) => c ?? queue.current.shift() ?? null)
    }

    const unsubLog = listenLog(tableId, (entries) => handleEntries(entries, false), 20)
    const unsubSecret = isGM ? listenSecretRolls(tableId, (entries) => handleEntries(entries, true), 10) : undefined
    return () => {
      unsubLog()
      unsubSecret?.()
    }
  }, [tableId, isGM])

  // Enquanto "rola", troca as faces rapidamente para dar sensação de movimento.
  useEffect(() => {
    if (!rolling || !current) return
    const interval = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(interval)
  }, [rolling, current])

  useEffect(() => {
    if (!current) return
    setRolling(true)
    const stopRolling = setTimeout(() => setRolling(false), 1100)
    const dismiss = setTimeout(() => {
      setCurrent(queue.current.shift() ?? null)
    }, 4200)
    return () => {
      clearTimeout(stopRolling)
      clearTimeout(dismiss)
    }
  }, [current])

  if (!current) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`animate-roll-in pointer-events-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur ${
          current.secret
            ? 'border-amber-600/60 bg-[var(--card-secret)]/95'
            : current.success === true && !rolling
              ? 'border-emerald-600/60 bg-[var(--card-success)]/95'
              : current.success === false && !rolling
                ? 'border-red-700/60 bg-[var(--card-fail)]/95'
                : 'border-purple-700/60 bg-[var(--card-neutral)]/95'
        }`}
      >
        <p className="text-xs uppercase tracking-widest text-purple-300/70">
          {current.secret && '🤫 '}
          {current.actorName} · {current.label}
        </p>
        <div className="flex max-w-[22rem] flex-wrap justify-center gap-2">
          {current.dice.map((d, i) => (
            <DieFace
              key={i}
              sides={current.sides}
              // Enquanto "rola", as faces trocam depressa — sempre dentro do
              // intervalo do próprio dado, para um d20 não piscar valores de d6.
              value={rolling ? 1 + ((tick * 3 + i * 5 + d) % current.sides) : d}
              rolling={rolling}
              delay={i * 90}
              size={current.dice.length > 5 ? 42 : 56}
            />
          ))}
        </div>
        {!rolling && <p className="text-center text-sm text-purple-100">{current.summary}</p>}
        <button
          onClick={() => setCurrent(queue.current.shift() ?? null)}
          className="text-[10px] uppercase tracking-wide text-purple-400/60 hover:text-purple-200"
        >
          fechar
        </button>
      </div>
    </div>
  )
}
