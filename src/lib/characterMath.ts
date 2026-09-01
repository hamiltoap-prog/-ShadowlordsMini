import type { AttributeKey, Attributes, CarriedArmor } from '../types'
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

export function rollStartingHp(attrs: Attributes): number {
  const r = roll('1d6+6')
  return r.total + sumModifiers(attrs)
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
