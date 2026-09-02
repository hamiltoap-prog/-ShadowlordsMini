import type { Character } from '../types'

/** Uma arma é "de longo alcance" se sua Habilidade for Pontaria (arcos, besta, funda). */
export function isRangedWeaponHabilidade(habilidade?: string): boolean {
  return Boolean(habilidade?.includes('Pontaria'))
}

/** Uma arma é "de combate corpo a corpo" se sua Habilidade for Combate ou Luta. */
export function isMeleeWeaponHabilidade(habilidade?: string): boolean {
  return Boolean(habilidade && /Combate|Luta/.test(habilidade))
}

/** Bônus racial passivo (Elfo/Meio-Orc) aplicado a uma rolagem de Ataque. */
export function ancestryAttackBonus(character: Character, weaponHabilidade?: string): number {
  if (character.ancestry === 'elfo' && character.ancestryChoice === 'ranged' && isRangedWeaponHabilidade(weaponHabilidade)) {
    return 1
  }
  if (character.ancestry === 'meio-orc' && isMeleeWeaponHabilidade(weaponHabilidade)) {
    return 1
  }
  return 0
}

/** Bônus racial passivo (Meio-Orc) aplicado a uma rolagem de Dano. */
export function ancestryDamageBonus(character: Character, weaponHabilidade?: string): number {
  if (character.ancestry === 'meio-orc' && isMeleeWeaponHabilidade(weaponHabilidade)) return 1
  return 0
}

/** Bônus racial passivo (Elfo) aplicado a testes de conjuração. */
export function ancestrySpellBonus(character: Character): number {
  if (character.ancestry === 'elfo' && character.ancestryChoice === 'spell') return 1
  return 0
}

export function ancestryTraitLabel(character: Character): string | null {
  switch (character.ancestry) {
    case 'anao':
      return 'Robusto: +2 PV inicial, PV rolado com vantagem'
    case 'elfo':
      return character.ancestryChoice === 'spell'
        ? 'Visão Longínqua: +1 em testes de conjuração'
        : 'Visão Longínqua: +1 em ataques com Pontaria'
    case 'goblin':
      return 'Sentidos Aguçados: não pode ser surpreendido'
    case 'meio-orc':
      return 'Poderoso: +1 em ataque e dano corpo a corpo'
    case 'halfling':
      return 'Furtivo: 1x/dia, invisível por 3 rodadas'
    case 'humano':
      return 'Ambicioso: Habilidade adicional na criação'
    default:
      return null
  }
}
