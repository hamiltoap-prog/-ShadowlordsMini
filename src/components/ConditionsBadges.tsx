import type { CharacterCondition } from '../types'
import { Badge } from './ui'

/** Mostra as condições de status ativas de um personagem (leitura). */
export function ConditionsBadges({ conditions }: { conditions: CharacterCondition[] }) {
  if (!conditions || conditions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {conditions.map((c) => (
        <span key={c.id} title={c.note}>
          <Badge tone="bad">⚠ {c.label}</Badge>
        </span>
      ))}
    </div>
  )
}
