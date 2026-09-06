import { ARMORS, GEAR, WEAPONS } from '../data/equipment'
import { EFFECT_TRIGGER_LABELS } from '../types'
import type {
  CarriedArmor,
  CarriedWeapon,
  CustomItem,
  CustomItemKind,
  InventoryItem,
  ItemEffect,
  ItemRarity,
} from '../types'
import { newId } from './id'

/**
 * Ponte entre o que está no manual e o que o Mestre forjou.
 *
 * A loja e o inventário não precisam saber a diferença: os dois lados viram
 * `ShopEntry`, e é a partir dela que a peça entra na ficha. O que o item tem de
 * próprio (mágico, efeitos, bônus) viaja junto para dentro da ficha, então a
 * arma continua completa mesmo que o Mestre apague o molde depois.
 */

export interface ShopEntry {
  key: string
  kind: CustomItemKind
  name: string
  custo: number
  icon?: string
  magical?: boolean
  rarity?: ItemRarity
  /** Destaque curto ao lado do nome: "3d6", "+2 Defesa". */
  extra?: string
  /** Linha de apoio: habilidade e tipo de dano, ou a proteção da armadura. */
  note?: string
  description?: string
  effectNote?: string
  dano?: string
  habilidade?: string
  tipo?: string
  alcance?: string
  defesaBonus?: number
  protecao?: string
  attackBonus?: number
  damageBonus?: number
  charges?: number
}

/** Resume os efeitos numa linha só, que é o que a narração da rolagem usa. */
export function effectSummary(effects?: ItemEffect[]): string | undefined {
  if (!effects || effects.length === 0) return undefined
  return effects
    .map((e) => {
      const chance = e.chance?.trim() ? ` (${e.chance.trim()})` : ''
      return `${e.name}${chance}`
    })
    .join(', ')
}

/** Descrição longa dos efeitos, para a ficha e a loja. */
export function effectDetails(effects?: ItemEffect[]): string | undefined {
  if (!effects || effects.length === 0) return undefined
  return effects
    .map((e) => {
      const chance = e.chance?.trim() ? ` — ${e.chance.trim()}` : ''
      return `${EFFECT_TRIGGER_LABELS[e.trigger]}: ${e.name}${chance}. ${e.description}`.trim()
    })
    .join(' · ')
}

export function customItemToEntry(item: CustomItem): ShopEntry {
  const base: ShopEntry = {
    key: `custom:${item.id}`,
    kind: item.kind,
    name: item.name,
    custo: item.custo,
    icon: item.icon,
    magical: item.magical,
    rarity: item.rarity,
    description: item.description,
    effectNote: effectSummary(item.effects),
    charges: item.charges,
  }
  if (item.kind === 'weapon') {
    const bonus = [
      item.attackBonus ? `${item.attackBonus > 0 ? '+' : ''}${item.attackBonus} ataque` : '',
      item.damageBonus ? `${item.damageBonus > 0 ? '+' : ''}${item.damageBonus} dano` : '',
    ].filter(Boolean)
    return {
      ...base,
      extra: item.dano,
      note: [item.habilidade, item.damageTypes?.join(' e '), item.alcance, ...bonus, effectDetails(item.effects)]
        .filter(Boolean)
        .join(' · '),
      dano: item.dano ?? '1d6',
      habilidade: item.habilidade,
      tipo: item.damageTypes?.join(' e '),
      alcance: item.alcance,
      attackBonus: item.attackBonus,
      damageBonus: item.damageBonus,
    }
  }
  if (item.kind === 'armor') {
    return {
      ...base,
      extra: `+${item.defesaBonus ?? 0} Defesa`,
      note: [item.protecao, effectDetails(item.effects)].filter(Boolean).join(' · '),
      defesaBonus: item.defesaBonus ?? 0,
      protecao: item.protecao,
    }
  }
  return { ...base, note: [item.description, effectDetails(item.effects)].filter(Boolean).join(' · ') }
}

/** Catálogo completo de uma categoria: manual + forja do Mestre. */
export function shopEntries(kind: CustomItemKind, customItems: CustomItem[]): ShopEntry[] {
  const forged = customItems.filter((i) => i.kind === kind).map(customItemToEntry)
  if (kind === 'weapon') {
    return [
      ...forged,
      ...WEAPONS.map<ShopEntry>((w) => ({
        key: `weapon:${w.name}`,
        kind: 'weapon',
        name: w.name,
        custo: w.custo,
        extra: w.dano,
        note: `${w.habilidade} · ${w.tipo}`,
        dano: w.dano,
        habilidade: w.habilidade,
        tipo: w.tipo,
      })),
    ]
  }
  if (kind === 'armor') {
    return [
      ...forged,
      ...ARMORS.map<ShopEntry>((a) => ({
        key: `armor:${a.name}`,
        kind: 'armor',
        name: a.name,
        custo: a.custo,
        extra: `+${a.defesa} Defesa`,
        note: a.protecao,
        defesaBonus: a.defesa,
        protecao: a.protecao,
      })),
    ]
  }
  return [
    ...forged,
    ...GEAR.map<ShopEntry>((g) => ({ key: `gear:${g.name}`, kind: 'gear', name: g.name, custo: g.custo })),
  ]
}

export function toCarriedWeapon(entry: ShopEntry): CarriedWeapon {
  return {
    id: newId(),
    name: entry.name,
    dano: entry.dano ?? '1d6',
    habilidade: entry.habilidade,
    tipo: entry.tipo,
    equipped: true,
    icon: entry.icon,
    magical: entry.magical,
    rarity: entry.rarity,
    description: entry.description,
    effectNote: entry.effectNote,
    attackBonus: entry.attackBonus,
    damageBonus: entry.damageBonus,
    alcance: entry.alcance,
  }
}

export function toCarriedArmor(entry: ShopEntry): CarriedArmor {
  return {
    id: newId(),
    name: entry.name,
    defesaBonus: entry.defesaBonus ?? 0,
    protecao: entry.protecao,
    equipped: true,
    icon: entry.icon,
    magical: entry.magical,
    rarity: entry.rarity,
    description: entry.description,
    effectNote: entry.effectNote,
  }
}

export function toInventoryItem(entry: ShopEntry): InventoryItem {
  return {
    id: newId(),
    name: entry.name,
    qty: 1,
    icon: entry.icon,
    magical: entry.magical,
    rarity: entry.rarity,
    description: entry.description,
    effectNote: entry.effectNote,
    charges: entry.charges,
  }
}

export const RARITY_STYLE: Record<ItemRarity, string> = {
  comum: 'text-purple-200',
  incomum: 'text-emerald-300',
  raro: 'text-sky-300',
  lendario: 'text-amber-300',
}
