import { useState } from 'react'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Attributes } from '../types'
import { damageRoll } from '../lib/mechanics'
import { Button, Select } from './ui'

export function DamageRoller({
  options,
  attributes,
  onConfirm,
}: {
  options: { label: string; dano: string }[]
  attributes?: Attributes
  onConfirm: (damage: ReturnType<typeof damageRoll>) => void | Promise<void>
}) {
  const [optionIdx, setOptionIdx] = useState(0)
  const [attrKey, setAttrKey] = useState<AttributeKey | ''>('')
  const [busy, setBusy] = useState(false)

  if (options.length === 0) return <p className="text-xs text-purple-400/50">Nenhuma arma disponível.</p>

  const chosen = options[optionIdx] ?? options[0]

  async function roll() {
    setBusy(true)
    try {
      const attrMod = attrKey && attributes ? attributes[attrKey].mod : 0
      const dmg = damageRoll({ weaponDano: chosen.dano, attrMod, weaponLabel: chosen.label })
      await onConfirm(dmg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={optionIdx} onChange={(e) => setOptionIdx(Number(e.target.value))} className="w-auto">
        {options.map((o, i) => (
          <option key={`${o.label}-${i}`} value={i}>
            {o.label} ({o.dano})
          </option>
        ))}
      </Select>
      {attributes && (
        <Select value={attrKey} onChange={(e) => setAttrKey(e.target.value as AttributeKey | '')} className="w-auto">
          <option value="">Sem Modificador</option>
          {ATTRIBUTE_KEYS.map((k) => (
            <option key={k} value={k}>
              {ATTRIBUTE_LABELS[k]} ({attributes[k].mod >= 0 ? '+' : ''}
              {attributes[k].mod})
            </option>
          ))}
        </Select>
      )}
      <Button variant="danger" disabled={busy} onClick={roll}>
        💥 Rolar Dano
      </Button>
    </div>
  )
}
