import { useState } from 'react'
import { logNote } from '../lib/actions'
import { donateHp } from '../lib/store'
import type { Character, GameTable } from '../types'
import { Button, Input, Select } from './ui'

/**
 * Doação de PV entre companheiros de mesa: alguém abre mão de parte da própria
 * vida para segurar outro em pé. Quem doa nunca cai abaixo de 1 PV — não dá
 * para morrer doando — e quem recebe nunca passa do próprio máximo.
 */
export function HpDonation({
  table,
  character,
  characters,
}: {
  table: GameTable
  character: Character
  characters: Character[]
}) {
  const [open, setOpen] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [amount, setAmount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const maxGive = Math.max(0, character.hp.current - 1)
  const target = characters.find((c) => c.id === targetId) ?? null
  const missingOnTarget = target ? Math.max(0, target.hp.max - target.hp.current) : 0
  const canGive = target ? Math.min(maxGive, missingOnTarget) : maxGive

  async function donate() {
    if (!target) return
    setBusy(true)
    setFeedback('')
    try {
      const given = await donateHp(table.id, character, target, amount)
      if (given <= 0) {
        setFeedback(missingOnTarget === 0 ? `${target.name} já está com os PV cheios.` : 'Você não tem PV de sobra.')
        return
      }
      await logNote(
        { tableId: table.id, actorName: character.name, actorType: 'player', characterId: character.id },
        `🤝 doou ${given} PV para ${target.name}`,
        'hp',
      )
      setFeedback(`${given} PV para ${target.name}.`)
      setTargetId('')
      setAmount(1)
      setTimeout(() => {
        setFeedback('')
        setOpen(false)
      }, 2200)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível doar agora.')
    } finally {
      setBusy(false)
    }
  }

  if (characters.length === 0) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={maxGive <= 0}
        title={maxGive > 0 ? 'Doar parte dos seus PV a um companheiro' : 'Sem PV de sobra para doar'}
        className="mt-1 self-start text-xs text-purple-400 transition hover:text-[color:var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        🤝 Doar PV
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-purple-800/50 bg-black/25 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-auto min-w-[9rem] text-xs">
          <option value="">Doar para...</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.hp.current}/{c.hp.max})
            </option>
          ))}
        </Select>
        <Input
          type="number"
          min={1}
          max={Math.max(1, canGive)}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Math.min(Math.max(1, canGive), Number(e.target.value))))}
          style={{ width: '4.5rem' }}
        />
        <Button variant="primary" className="text-xs" disabled={!target || busy || canGive <= 0} onClick={donate}>
          Doar
        </Button>
        <button className="text-xs text-purple-400 hover:text-purple-100" onClick={() => setOpen(false)}>
          fechar
        </button>
      </div>
      <p className="text-[11px] text-purple-400/60">
        Você pode doar até {maxGive} PV{target && ` — ${target.name} ainda cabe ${missingOnTarget}`}. Ninguém doa a
        ponto de cair a 0.
      </p>
      {feedback && <p className="text-[11px] text-emerald-300">{feedback}</p>}
    </div>
  )
}
