import { useState } from 'react'
import { awardXp } from '../lib/actions'
import { updateCharacter } from '../lib/store'
import type { Character } from '../types'
import { Button, Input, NumberInput } from './ui'

/**
 * XP pelas mãos do Mestre (Pontos de Experiência, pág. 63): ele dá XP ao fim
 * da aventura, por um feito ou por uma boa ideia, e o jogador gasta na ficha.
 * Dar e tirar ficam no registro da mesa; "corrigir" ajusta os números direto,
 * para consertar um engano sem fazer barulho.
 */
export function GmXpControls({ tableId, character }: { tableId: string; character: Character }) {
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [fixing, setFixing] = useState(false)

  async function give(sign: 1 | -1) {
    setBusy(true)
    try {
      await awardXp(tableId, character, sign * amount, reason)
      setReason('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-purple-900/30 pb-3 text-sm" data-gm-xp="">
      <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--gold)]/80">Mestre: XP do personagem</p>
      <div className="flex flex-wrap items-center gap-2">
        <NumberInput min={1} value={amount} onChange={setAmount} style={{ width: '4.5rem' }} data-xp-amount="" />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="motivo (opcional) — ex.: fim da aventura"
          style={{ width: '16rem', maxWidth: '100%' }}
          data-xp-reason=""
        />
        <Button variant="primary" disabled={busy || amount < 1} onClick={() => give(1)} data-xp-give="">
          + dar XP
        </Button>
        <Button variant="danger" disabled={busy || amount < 1 || character.xp === 0} onClick={() => give(-1)} data-xp-take="">
          − tirar
        </Button>
        <button className="text-xs text-purple-400/70 hover:text-[color:var(--gold)]" onClick={() => setFixing((v) => !v)}>
          {fixing ? 'fechar correção' : 'corrigir números'}
        </button>
      </div>
      {fixing && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-purple-300/70">
          <label className="flex items-center gap-1">
            XP disponível
            <NumberInput
              min={0}
              value={character.xp}
              onChange={(n) => updateCharacter(tableId, character.id, { xp: n })}
              style={{ width: '4.5rem' }}
              data-xp-fix=""
            />
          </label>
          <label className="flex items-center gap-1">
            XP já gasto
            <NumberInput
              min={0}
              value={character.xpSpent}
              onChange={(n) => updateCharacter(tableId, character.id, { xpSpent: n })}
              style={{ width: '4.5rem' }}
              data-xp-spent-fix=""
            />
          </label>
        </div>
      )}
    </div>
  )
}

/** "Dar XP ao grupo": o mesmo valor para todos os personagens vivos, ou um a um. */
export function GroupXpAward({ tableId, characters }: { tableId: string; characters: Character[] }) {
  const [amount, setAmount] = useState(1)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const alive = characters.filter((c) => c.isAlive)

  async function give(targets: Character[]) {
    if (targets.length === 0) return
    setBusy(true)
    try {
      await Promise.all(targets.map((c) => awardXp(tableId, c, amount, reason)))
      setDone(targets.length === 1 ? `${amount} XP para ${targets[0].name}.` : `${amount} XP para ${targets.length} personagens.`)
      setTimeout(() => setDone(''), 3000)
      setReason('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-3" data-group-xp="">
      <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--gold)]/80">⭐ Dar XP</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <NumberInput min={1} value={amount} onChange={setAmount} style={{ width: '4.5rem' }} data-group-xp-amount="" />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="motivo (opcional)"
          style={{ width: '12rem', maxWidth: '100%' }}
        />
        <Button variant="primary" disabled={busy || amount < 1 || alive.length === 0} onClick={() => give(alive)} data-group-xp-all="">
          dar a todos ({alive.length})
        </Button>
        {done && <span className="text-xs text-emerald-300">{done}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {characters.map((c) => (
          <button
            key={c.id}
            disabled={busy || amount < 1}
            onClick={() => give([c])}
            className="border border-[color:var(--gold-deep)] px-2 py-0.5 text-xs text-purple-200 hover:border-[color:var(--gold)] hover:text-[color:var(--gold-bright)] disabled:opacity-40"
            title={`Dar ${amount} XP só para ${c.name}`}
            data-xp-one={c.name}
          >
            + {c.name} <span className="text-purple-400/60">({c.xp} XP)</span>
          </button>
        ))}
      </div>
    </div>
  )
}
