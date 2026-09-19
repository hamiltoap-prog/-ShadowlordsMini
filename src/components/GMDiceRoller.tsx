import { useEffect, useState } from 'react'
import { attributeTest } from '../lib/mechanics'
import { formatCheck } from '../lib/format'
import { addLogEntry, addSecretRoll, listenSecretRolls } from '../lib/store'
import { FreeDiceRoller } from './FreeDiceRoller'
import type { GameTable, LogEntry } from '../types'
import { Badge, Button, Card, Input } from './ui'

/**
 * Rolagens do próprio Mestre. Pode ser aberta (todos veem e a animação aparece
 * para a mesa toda) ou secreta (só o Mestre vê, nem entra no log público).
 */
export function GMDiceRoller({ table }: { table: GameTable }) {
  const [label, setLabel] = useState('')
  const [difficulty, setDifficulty] = useState(13)
  const [modifier, setModifier] = useState(0)
  const [secret, setSecret] = useState(true)
  const [busy, setBusy] = useState(false)
  const [secretRolls, setSecretRolls] = useState<LogEntry[]>([])

  useEffect(() => listenSecretRolls(table.id, setSecretRolls, 12), [table.id])

  async function rollTest() {
    setBusy(true)
    try {
      const check = attributeTest({ attrMod: modifier, difficulty, label: label || 'Teste do Mestre' })
      const entry = {
        actorName: 'Mestre',
        actorType: 'gm' as const,
        kind: 'attribute_test' as const,
        summary: formatCheck(check),
        rolls: check.roll.rolls,
        total: check.total,
        success: check.success,
        dice: check.roll.rolls,
        diceLabel: label || 'Teste do Mestre',
      }
      if (secret) await addSecretRoll(table.id, entry)
      else await addLogEntry(table.id, entry)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <FreeDiceRoller table={table} actorName="Mestre" actorType="gm" allowSecret title="Rolagem do Mestre" />

      <div className="flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-2">
        <button
          onClick={() => setSecret((v) => !v)}
          className="text-xs"
          title="Vale para o Teste de Atributo abaixo"
        >
          {secret ? <Badge tone="bad">🤫 secreto</Badge> : <Badge tone="good">👁 visível</Badge>}
        </button>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo (ex: emboscada)" className="w-40" />
        <span className="text-sm text-purple-300/70">mod.</span>
        <Input type="number" value={modifier} onChange={(e) => setModifier(Number(e.target.value))} className="w-16" />
        <span className="text-sm text-purple-300/70">Teste de Atributo — dificuldade</span>
        <Input type="number" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="w-16" />
        <Button disabled={busy} onClick={rollTest}>
          🎲 Testar
        </Button>
      </div>

      {secretRolls.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-purple-900/30 pt-2">
          <p className="text-xs uppercase text-purple-400/60">Suas rolagens secretas</p>
          {secretRolls.map((r) => (
            <p key={r.id} className="text-xs text-amber-200/80">
              🤫 {r.summary}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}
