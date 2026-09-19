import { useState } from 'react'
import { DIE_TYPES, rollN } from '../lib/dice'
import type { DieType } from '../lib/dice'
import { addLogEntry, addSecretRoll } from '../lib/store'
import type { GameTable, LogEntry } from '../types'
import { DieFace } from './DieFace'
import { Badge, Button, Input, SectionTitle } from './ui'

/**
 * Rolagem livre — a que não está presa a nenhuma ação da ficha. Serve tanto ao
 * Mestre (que pode rolar escondido) quanto aos jogadores, que até agora só
 * conseguiam rolar pedindo um teste, ataque ou dano.
 */
export function FreeDiceRoller({
  table,
  actorName,
  actorType,
  characterId,
  allowSecret = false,
  title = 'Rolagem Livre',
}: {
  table: GameTable
  actorName: string
  actorType: 'player' | 'gm'
  characterId?: string
  /** Só o Mestre pode esconder a rolagem da mesa. */
  allowSecret?: boolean
  title?: string
}) {
  const [count, setCount] = useState(1)
  const [sides, setSides] = useState<DieType>(6)
  const [modifier, setModifier] = useState(0)
  const [label, setLabel] = useState('')
  const [secret, setSecret] = useState(false)
  const [busy, setBusy] = useState(false)

  const notation = `${count}d${sides}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`

  async function send() {
    setBusy(true)
    try {
      const rolls = rollN(count, sides)
      const sum = rolls.reduce((a, b) => a + b, 0)
      const total = sum + modifier
      const entry: Omit<LogEntry, 'id' | 'tableId' | 'ts'> = {
        actorName,
        actorType,
        characterId,
        kind: 'note',
        summary: `${label.trim() || 'Rolagem livre'}: ${notation} [${rolls.join(', ')}]${
          modifier ? ` ${modifier >= 0 ? '+' : ''}${modifier}` : ''
        } = ${total}`,
        rolls,
        total,
        dice: rolls,
        diceSides: sides,
        diceLabel: label.trim() || notation,
      }
      if (secret && allowSecret) await addSecretRoll(table.id, entry)
      else await addLogEntry(table.id, entry)
      setLabel('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>🎲 {title}</SectionTitle>
        {allowSecret && (
          <button onClick={() => setSecret((v) => !v)} title="Rolagem secreta não aparece para os jogadores">
            {secret ? <Badge tone="bad">🤫 secreta</Badge> : <Badge tone="good">👁 visível a todos</Badge>}
          </button>
        )}
      </div>

      {/* Escolha do dado pela própria cara dele — mais rápido de achar que uma
          lista suspensa, e já mostra como a peça vai aparecer na animação. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DIE_TYPES.map((d) => (
          <button
            key={d}
            onClick={() => setSides(d)}
            title={`Rolar d${d}`}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
              sides === d
                ? 'border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold-bright)]'
                : 'border-purple-800/50 text-purple-300/70 hover:border-purple-500'
            }`}
          >
            <DieFace value={d} sides={d} size={22} />d{d}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-purple-200">
        <label className="flex items-center gap-1.5">
          Quantos
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
            style={{ width: '4.5rem' }}
          />
        </label>
        <label className="flex items-center gap-1.5">
          Mod.
          <Input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(Number(e.target.value))}
            style={{ width: '4.5rem' }}
          />
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Para quê? (opcional)"
          className="min-w-[9rem] flex-1"
        />
        <Button variant="primary" disabled={busy} onClick={send}>
          Rolar {notation}
        </Button>
      </div>
    </div>
  )
}
