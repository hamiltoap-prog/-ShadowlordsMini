import { useState } from 'react'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Attributes, CharacterSkill } from '../types'
import { attackRoll, attributeTest, type CheckResult } from '../lib/mechanics'
import { Badge, Button, Input, Select } from './ui'

export function CheckPanel({
  title,
  attributes,
  skills,
  hpCurrent,
  mode,
  defaultAttr = 'for',
  defaultTarget = 13,
  allowTargetEdit = false,
  targetLabel,
  onConfirm,
}: {
  title: string
  attributes: Attributes
  skills: CharacterSkill[]
  hpCurrent: number
  mode: 'test' | 'attack'
  defaultAttr?: AttributeKey
  defaultTarget?: number
  allowTargetEdit?: boolean
  targetLabel?: string
  onConfirm: (check: CheckResult, hpSpent: number) => void | Promise<void>
}) {
  const [attrKey, setAttrKey] = useState<AttributeKey>(defaultAttr)
  const [skillName, setSkillName] = useState<string>('')
  const [target, setTarget] = useState(defaultTarget)
  const [preview, setPreview] = useState<CheckResult | null>(null)
  const [pvSpent, setPvSpent] = useState(0)
  const [confirming, setConfirming] = useState(false)

  const skillBonus = skillName ? 1 : 0

  function doRoll() {
    const attrMod = attributes[attrKey].mod
    const check =
      mode === 'test'
        ? attributeTest({ attrMod, skillBonus, difficulty: target, label: title })
        : attackRoll({ attrMod, skillBonus, targetDefense: target, label: title })
    setPreview(check)
    setPvSpent(0)
  }

  function reset() {
    setPreview(null)
    setPvSpent(0)
  }

  async function confirm(finalTotal: number, hpSpent: number) {
    if (!preview) return
    setConfirming(true)
    try {
      const success = finalTotal >= preview.target
      await onConfirm({ ...preview, hpSpent, total: finalTotal, success }, hpSpent)
      reset()
    } finally {
      setConfirming(false)
    }
  }

  const boostedTotal = preview ? preview.total + pvSpent : 0
  const maxPv = Math.max(0, hpCurrent - 1)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-purple-300/70">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
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
        {allowTargetEdit && (
          <span className="flex items-center gap-1 text-sm text-purple-300/70">
            {targetLabel ?? 'Alvo'}:
            <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-16" />
          </span>
        )}
        {!allowTargetEdit && (
          <span className="text-sm text-purple-300/70">
            {targetLabel ?? 'Dificuldade'}: {target}
          </span>
        )}
        <Button variant="primary" onClick={doRoll}>
          🎲 Rolar
        </Button>
      </div>

      {preview && (
        <div className={`animate-roll-in rounded-lg border p-2 text-sm ${preview.success ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-red-800/50 bg-red-950/20'}`}>
          <p className="text-purple-100">
            3d6 [{preview.roll.rolls.join(', ')}] = {preview.roll.total}
            {preview.attrMod ? ` ${preview.attrMod >= 0 ? '+' : ''}${preview.attrMod}` : ''}
            {preview.skillBonus ? ` +${preview.skillBonus}` : ''} = <b>{preview.total}</b> vs {target}
          </p>
          {!preview.success && pvSpent === 0 && (
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="bad">Fracasso</Badge>
              {maxPv > 0 && <span className="text-xs text-purple-300/60">Pode gastar PV para tentar melhorar.</span>}
            </div>
          )}
          {pvSpent > 0 && (
            <p className="mt-1">
              + gastando {pvSpent} PV = <b>{boostedTotal}</b> →{' '}
              <Badge tone={boostedTotal >= target ? 'good' : 'bad'}>{boostedTotal >= target ? 'Sucesso' : 'Ainda fracasso'}</Badge>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!preview.success && maxPv > 0 && (
              <>
                <span className="text-xs text-purple-300/60">Gastar PV:</span>
                <Input
                  type="number"
                  min={0}
                  max={maxPv}
                  value={pvSpent}
                  onChange={(e) => setPvSpent(Math.max(0, Math.min(maxPv, Number(e.target.value))))}
                  className="w-16"
                />
              </>
            )}
            <Button variant="primary" disabled={confirming} onClick={() => confirm(boostedTotal, pvSpent)}>
              Registrar
            </Button>
            <Button variant="ghost" onClick={reset}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
