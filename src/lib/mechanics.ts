import { curseByD66 } from '../data/spells'
import { type DiceResult, roll, roll1d66, roll3d6 } from './dice'

export interface CheckResult {
  kind: 'attribute_test' | 'attack'
  roll: DiceResult
  attrMod: number
  skillBonus: number
  hpSpent: number
  total: number
  target: number
  success: boolean
  label: string
}

/** Teste de Atributo (pág. 36): 3d6 + Modificador vs Dificuldade (padrão 13). */
export function attributeTest(opts: {
  attrMod: number
  skillBonus?: number
  hpSpent?: number
  difficulty?: number
  label?: string
}): CheckResult {
  const skillBonus = opts.skillBonus ?? 0
  const hpSpent = opts.hpSpent ?? 0
  const difficulty = opts.difficulty ?? 13
  const r = roll3d6()
  const total = r.total + opts.attrMod + skillBonus + hpSpent
  return {
    kind: 'attribute_test',
    roll: r,
    attrMod: opts.attrMod,
    skillBonus,
    hpSpent,
    total,
    target: difficulty,
    success: total >= difficulty,
    label: opts.label ?? 'Teste de Atributo',
  }
}

/** Ataque (pág. 40): 3d6 + Modificador vs Defesa do oponente. */
export function attackRoll(opts: {
  attrMod: number
  skillBonus?: number
  hpSpent?: number
  targetDefense: number
  label?: string
}): CheckResult {
  const skillBonus = opts.skillBonus ?? 0
  const hpSpent = opts.hpSpent ?? 0
  const r = roll3d6()
  const total = r.total + opts.attrMod + skillBonus + hpSpent
  return {
    kind: 'attack',
    roll: r,
    attrMod: opts.attrMod,
    skillBonus,
    hpSpent,
    total,
    target: opts.targetDefense,
    success: total >= opts.targetDefense,
    label: opts.label ?? 'Ataque',
  }
}

export interface DamageResult {
  roll: DiceResult
  attrMod: number
  total: number
  weaponLabel: string
}

/** Dano (pág. 41): Dano da Arma + Modificador. Mínimo de 1. */
export function damageRoll(opts: { weaponDano: string; attrMod?: number; weaponLabel?: string }): DamageResult {
  const attrMod = opts.attrMod ?? 0
  const r = roll(opts.weaponDano)
  const total = Math.max(1, r.total + attrMod)
  return { roll: r, attrMod, total, weaponLabel: opts.weaponLabel ?? opts.weaponDano }
}

export interface SpellCastResult {
  check: CheckResult
  pvCost: number
  curse?: { d66: number; effect: string }
}

/** Feitiçaria (pág. 57): gasta PV, então rola Teste de Atributo. Falha => Maldição (pág. 61). */
export function castSpell(opts: {
  attrMod: number
  skillBonus?: number
  hpSpent?: number
  pvCost: number
  difficulty?: number
  label?: string
}): SpellCastResult {
  const check = attributeTest({
    attrMod: opts.attrMod,
    skillBonus: opts.skillBonus,
    hpSpent: opts.hpSpent,
    difficulty: opts.difficulty,
    label: opts.label ?? 'Feitiçaria',
  })
  if (check.success) return { check, pvCost: opts.pvCost }
  const d66 = roll1d66()
  const curse = curseByD66(d66.value)
  return { check, pvCost: opts.pvCost, curse: { d66: d66.value, effect: curse.effect } }
}
