import { useState } from 'react'
import { newId } from '../lib/id'
import { updateCharacter } from '../lib/store'
import type { Character } from '../types'
import { Badge, Button, Input } from './ui'

const COMMON_CONDITIONS = [
  'Envenenado',
  'Paralisado',
  'Amaldiçoado',
  'Cego',
  'Atordoado',
  'Amedrontado',
  'Inconsciente',
  'Doente',
]

/** Só o Mestre usa: adiciona ou remove condições de status de um personagem. */
export function ConditionsEditor({ tableId, character }: { tableId: string; character: Character }) {
  const [custom, setCustom] = useState('')
  const conditions = character.conditions ?? []

  async function add(label: string) {
    if (!label.trim()) return
    await updateCharacter(tableId, character.id, {
      conditions: [...conditions, { id: newId(), label: label.trim(), createdAt: Date.now() }],
    })
    setCustom('')
  }

  async function remove(id: string) {
    await updateCharacter(tableId, character.id, { conditions: conditions.filter((c) => c.id !== id) })
  }

  return (
    <div className="flex flex-col gap-2">
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((c) => (
            <button key={c.id} onClick={() => remove(c.id)} title="Clique para remover">
              <Badge tone="bad">⚠ {c.label} ✕</Badge>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {COMMON_CONDITIONS.filter((c) => !conditions.some((x) => x.label === c)).map((c) => (
          <button
            key={c}
            onClick={() => add(c)}
            className="rounded-full border border-purple-900/50 px-2 py-0.5 text-xs text-purple-300/70 hover:border-purple-600"
          >
            + {c}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Outra condição" className="w-40" />
        <Button onClick={() => add(custom)} disabled={!custom.trim()}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}
