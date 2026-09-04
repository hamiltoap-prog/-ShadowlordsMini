import { useState } from 'react'
import { XP_TABLE } from '../data/tables'
import { recomputeMod } from '../lib/characterMath'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Character } from '../types'
import { Button, Input, Select } from './ui'

export function XpPanel({
  character,
  onApply,
}: {
  character: Character
  onApply: (patch: Partial<Character>, summary: string) => void | Promise<void>
}) {
  const [attrKey, setAttrKey] = useState<AttributeKey>('for')
  const [newSkill, setNewSkill] = useState('')
  const [busy, setBusy] = useState(false)

  async function spend(cost: number, patch: Partial<Character>, summary: string) {
    if (character.xp < cost) return
    setBusy(true)
    try {
      await onApply({ ...patch, xp: character.xp - cost, xpSpent: character.xpSpent + cost }, summary)
    } finally {
      setBusy(false)
    }
  }

  function spendHp() {
    spend(1, { hp: { current: character.hp.current + 1, max: character.hp.max + 1 } }, 'gastou 1 XP: +1 Ponto de Vida (máx.)')
  }

  function spendSkill() {
    if (!newSkill.trim()) return
    spend(2, { skills: [...character.skills, { name: newSkill.trim() }] }, `gastou 2 XP: nova Habilidade — ${newSkill.trim()}`)
    setNewSkill('')
  }

  function spendDefense() {
    spend(3, { baseDefense: character.baseDefense + 1, defense: character.defense + 1 }, 'gastou 3 XP: +1 em Defesa')
  }

  function spendAttribute() {
    const attrs = { ...character.attributes }
    const newScore = attrs[attrKey].score + 1
    attrs[attrKey] = { score: newScore, mod: recomputeMod(newScore) }
    spend(4, { attributes: attrs }, `gastou 4 XP: +1 em ${ATTRIBUTE_LABELS[attrKey]} (agora ${newScore})`)
  }

  function spendModifier() {
    const attrs = { ...character.attributes }
    attrs[attrKey] = { ...attrs[attrKey], mod: attrs[attrKey].mod + 1 }
    spend(5, { attributes: attrs }, `gastou 5 XP: +1 no Modificador de ${ATTRIBUTE_LABELS[attrKey]}`)
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-purple-200">
        XP disponível: <b>{character.xp}</b> (total gasto: {character.xpSpent})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={busy || character.xp < 1} onClick={spendHp} title={XP_TABLE[0].label}>
          +1 PV máx · 1 XP
        </Button>
        <div className="flex gap-1">
          <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Nova Habilidade" />
          <Button disabled={busy || character.xp < 2 || !newSkill.trim()} onClick={spendSkill}>
            2 XP
          </Button>
        </div>
        <Button disabled={busy || character.xp < 3} onClick={spendDefense} title={XP_TABLE[2].label}>
          +1 Defesa · 3 XP
        </Button>
        <div className="flex gap-1">
          <Select value={attrKey} onChange={(e) => setAttrKey(e.target.value as AttributeKey)} className="w-auto">
            {ATTRIBUTE_KEYS.map((k) => (
              <option key={k} value={k}>
                {ATTRIBUTE_LABELS[k]}
              </option>
            ))}
          </Select>
          <Button disabled={busy || character.xp < 4} onClick={spendAttribute} title="+1 Atributo">
            +1 Atrib · 4 XP
          </Button>
          <Button disabled={busy || character.xp < 5} onClick={spendModifier} title="+1 Modificador">
            +1 Mod · 5 XP
          </Button>
        </div>
      </div>
    </div>
  )
}
