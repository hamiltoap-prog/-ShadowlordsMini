import { totalDefense } from './characterMath'
import type { AttributeKey, Character, ItemBonus, ItemBonusTarget } from '../types'
import { itemBonusLabel } from '../types'

/**
 * O que os itens equipados dão à ficha.
 *
 * Tudo que um item concede passa por aqui — a Defesa da armadura e os bônus
 * que o Mestre dá na forja (Defesa, PV máximos, ataque, dano, feitiçaria,
 * testes). Assim o jogador não precisa lembrar de somar nada: equipou, vale;
 * guardou, deixou de valer.
 */

type Carrying = Pick<Character, 'weapons' | 'armor' | 'equipment'>

interface ActiveItem {
  name: string
  bonuses?: ItemBonus[]
}

/** Os itens que valem agora: armas e armaduras equipadas, e o equipamento em
 *  uso (sem a marcação, conta como em uso). */
export function activeItems(c: Carrying): ActiveItem[] {
  return [
    ...(c.weapons ?? []).filter((w) => w.equipped),
    ...(c.armor ?? []).filter((a) => a.equipped),
    ...(c.equipment ?? []).filter((i) => i.equipped !== false),
  ]
}

export interface BonusSource {
  name: string
  value: number
}

/** De onde vem cada ponto de um bônus — para a ficha poder mostrar a conta. */
export function bonusSources(c: Carrying, target: ItemBonusTarget): BonusSource[] {
  const out: BonusSource[] = []
  for (const item of activeItems(c)) {
    const value = (item.bonuses ?? []).filter((b) => b.target === target).reduce((sum, b) => sum + b.value, 0)
    if (value) out.push({ name: item.name, value })
  }
  return out
}

export function gearBonus(c: Carrying, target: ItemBonusTarget): number {
  return bonusSources(c, target).reduce((sum, s) => sum + s.value, 0)
}

/** Teste de atributo: o bônus de "todos os testes" mais o daquele atributo. */
export function gearTestBonus(c: Carrying, attr: AttributeKey): number {
  return gearBonus(c, 'testes') + gearBonus(c, `teste:${attr}`)
}

/** Defesa: base, mais as armaduras equipadas, mais os bônus de Defesa. */
export function computeDefense(c: Carrying & Pick<Character, 'baseDefense'>): number {
  return totalDefense(c.baseDefense, c.armor ?? []) + gearBonus(c, 'defesa')
}

/**
 * Completa uma mudança nos itens da ficha com o que ela provoca: a Defesa
 * recalculada e, se os PV máximos vindos de itens mudaram, os PV ajustados
 * pela diferença.
 *
 * Os PV atuais andam junto com o máximo, nos dois sentidos: vestir o amuleto
 * de +3 dá 3 PV na hora, e tirá-lo tira os mesmos 3. Se tirar só cortasse o que
 * passasse do novo máximo, pôr e tirar o item repetidas vezes curaria de graça.
 * A única proteção: tirar um item nunca derruba alguém de pé abaixo de 1 PV.
 */
export function withGearEffects(c: Character, patch: Partial<Character>): Partial<Character> {
  const next = { ...c, ...patch }
  const out: Partial<Character> = { ...patch, defense: computeDefense(next) }
  const hpBonus = gearBonus(next, 'pvMax')
  const applied = c.gearHpBonus ?? 0
  if (hpBonus !== applied) {
    const delta = hpBonus - applied
    const max = Math.max(1, next.hp.max + delta)
    let current = Math.min(max, next.hp.current + delta)
    if (next.hp.current > 0) current = Math.max(1, current)
    out.hp = { max, current: Math.max(0, current) }
    out.gearHpBonus = hpBonus
  }
  return out
}

/** "+1 Defesa", "−1 Testes de Agilidade" — para listas e selos. */
export function formatBonus(b: ItemBonus): string {
  return `${b.value > 0 ? '+' : '−'}${Math.abs(b.value)} ${itemBonusLabel(b.target)}`
}

/** Só os bônus que valem alguma coisa (o editor da forja pode deixar zeros). */
export function cleanBonuses(bonuses?: ItemBonus[]): ItemBonus[] | undefined {
  const kept = (bonuses ?? []).filter((b) => Number.isFinite(b.value) && b.value !== 0)
  return kept.length ? kept : undefined
}
