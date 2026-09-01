import { useEffect, useState } from 'react'
import { listenLog } from '../lib/store'
import type { LogEntry } from '../types'
import { Card, SectionTitle } from './ui'

const KIND_ICON: Record<LogEntry['kind'], string> = {
  attribute_test: '🎲',
  attack: '⚔️',
  damage: '💥',
  spell: '✨',
  curse: '☠️',
  note: '📜',
  xp: '⭐',
  hp: '❤️',
  table: '🏰',
  random_table: '🔮',
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'agora'
  if (s < 60) return `${s}s atrás`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  return `${h}h atrás`
}

export function LogFeed({ tableId, compact = false }: { tableId: string; compact?: boolean }) {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    return listenLog(tableId, setEntries)
  }, [tableId])

  return (
    <Card className={compact ? '' : 'p-4'}>
      {!compact && <SectionTitle className="mb-3">Registro da Sessão</SectionTitle>}
      <div className={`flex flex-col gap-1.5 overflow-y-auto ${compact ? 'max-h-[40vh] p-3' : 'max-h-[65vh]'}`}>
        {entries.length === 0 && <p className="text-sm text-purple-300/50">Nenhuma rolagem ainda. Boa sorte!</p>}
        {entries.map((e) => (
          <div
            key={e.id}
            className={`animate-roll-in rounded-lg border px-3 py-2 text-sm leading-snug ${
              e.success === true
                ? 'border-emerald-800/40 bg-emerald-950/30'
                : e.success === false
                  ? 'border-red-900/40 bg-red-950/20'
                  : 'border-purple-900/30 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs text-purple-300/60">
              <span className="font-semibold text-purple-200">
                {KIND_ICON[e.kind]} {e.actorName}
              </span>
              <span>{timeAgo(e.ts)}</span>
            </div>
            <p className="mt-0.5 text-purple-50">{e.summary}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
