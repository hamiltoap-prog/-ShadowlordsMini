import { useState } from 'react'
import { SPELLS } from '../data/spells'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Attributes, CharacterSkill } from '../types'
import { castSpell, type SpellCastResult } from '../lib/mechanics'
import { Button, Select } from './ui'

export function SpellPanel({
  attributes,
  skills,
  hpCurrent,
  onConfirm,
}: {
  attributes: Attributes
  skills: CharacterSkill[]
  hpCurrent: number
  onConfirm: (spellName: string, result: SpellCastResult) => void | Promise<void>
}) {
  const [spellName, setSpellName] = useState(SPELLS[0].name)
  const [attrKey, setAttrKey] = useState<AttributeKey>('int')
  const [skillName, setSkillName] = useState('')
  const [busy, setBusy] = useState(false)

  const spell = SPELLS.find((s) => s.name === spellName) ?? SPELLS[0]
  const canAfford = hpCurrent > spell.custo

  async function cast() {
    setBusy(true)
    try {
      const result = castSpell({
        attrMod: attributes[attrKey].mod,
        skillBonus: skillName ? 1 : 0,
        pvCost: spell.custo,
        label: `Feitiço: ${spell.name}`,
      })
      await onConfirm(spell.name, result)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-purple-300/70">Feitiçaria</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={spellName} onChange={(e) => setSpellName(e.target.value)} className="w-auto min-w-[12rem]">
          {SPELLS.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} (-{s.custo} PV)
            </option>
          ))}
        </Select>
        <Select value={attrKey} onChange={(e) => setAttrKey(e.target.value as AttributeKey)} className="w-auto">
          {ATTRIBUTE_KEYS.map((k) => (
            <option key={k} value={k}>
              {ATTRIBUTE_LABELS[k]} ({attributes[k].mod >= 0 ? '+' : ''}
              {attributes[k].mod})
            </option>
          ))}
        </Select>
        <Select value={skillName} onChange={(e) => setSkillName(e.target.value)} className="w-auto">
          <option value="">Sem Habilidade</option>
          {skills.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} (+1)
            </option>
          ))}
        </Select>
        <Button variant="primary" disabled={!canAfford || busy} onClick={cast}>
          ✨ Conjurar
        </Button>
      </div>
      <p className="text-xs text-purple-300/60">{spell.efeito}</p>
      {!canAfford && <p className="text-xs text-red-400">PV insuficiente para conjurar este feitiço.</p>}
    </div>
  )
}
