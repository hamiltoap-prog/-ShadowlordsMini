import type { AncestryKey, AttributeKey, Attributes, CarriedArmor } from '../types'
import { ATTRIBUTE_KEYS } from '../types'
import { attributeModFromScore, rollAttributeScore, roll } from './dice'

export function emptyAttributes(): Attributes {
  const attrs = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) attrs[k] = { score: 9, mod: 0 }
  return attrs
}

export function rollAllAttributes(): Attributes {
  const attrs = {} as Attributes
  for (const k of ATTRIBUTE_KEYS) {
    const r = rollAttributeScore()
    attrs[k] = { score: r.score, mod: r.mod }
  }
  return attrs
}

export function sumModifiers(attrs: Attributes): number {
  return ATTRIBUTE_KEYS.reduce((sum, k) => sum + attrs[k].mod, 0)
}

/** PV inicial: 1d6+6 + soma dos Modificadores (pág. 22). Anões rolam o dado
 * com vantagem (duas rolagens, fica com a maior) e somam +2 PV (Robusto). */
export function rollStartingHp(attrs: Attributes, ancestry?: AncestryKey): number {
  const first = roll('1d6+6')
  const best = ancestry === 'anao' ? Math.max(first.total, roll('1d6+6').total) : first.total
  const bonus = ancestry === 'anao' ? 2 : 0
  return best + sumModifiers(attrs) + bonus
}

export function baseDefenseFromAgi(attrs: Attributes): number {
  return 10 + attrs.agi.mod
}

export function totalDefense(baseDefense: number, armor: CarriedArmor[]): number {
  const bonus = armor.filter((a) => a.equipped).reduce((sum, a) => sum + a.defesaBonus, 0)
  return baseDefense + bonus
}

export function recomputeMod(score: number): number {
  return attributeModFromScore(score)
}

export function attrLabel(key: AttributeKey): string {
  return key.toUpperCase()
}
