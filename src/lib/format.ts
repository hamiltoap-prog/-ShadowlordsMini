import type { CheckResult, DamageResult, SpellCastResult } from './mechanics'

export function formatCheck(check: CheckResult): string {
  const dice = `[${check.roll.rolls.join(', ')}]`
  const parts = [`3d6 ${dice}=${check.roll.total}`]
  if (check.attrMod) parts.push(`${check.attrMod >= 0 ? '+' : ''}${check.attrMod} atr.`)
  if (check.skillBonus) parts.push(`${check.skillBonus >= 0 ? '+' : ''}${check.skillBonus} hab.`)
  if (check.hpSpent) parts.push(`+${check.hpSpent} PV`)
  const vsWord = check.kind === 'attack' ? 'Defesa' : 'Dificuldade'
  return `${check.label}: ${parts.join(' ')} = ${check.total} vs ${vsWord} ${check.target} → ${
    check.success ? 'Sucesso' : 'Fracasso'
  }`
}

export function formatDamage(damage: DamageResult, targetName?: string): string {
  const dice = damage.roll.rolls.length ? `[${damage.roll.rolls.join(', ')}]` : ''
  const modPart = damage.attrMod ? ` ${damage.attrMod >= 0 ? '+' : ''}${damage.attrMod}` : ''
  const alvo = targetName ? ` em ${targetName}` : ''
  return `Dano (${damage.weaponLabel}): ${damage.roll.notation} ${dice}${modPart} = ${damage.total}${alvo}`
}

/** Narra dano + efeito logo após um ataque bem-sucedido, ex: "causou 15 de
 * dano em Aranha Gigante — Veneno. Paralisia: 1-3 em 1d6". */
export function formatDamageAndEffect(damage: DamageResult, effectNote?: string, targetName?: string): string {
  const alvo = targetName ? ` em ${targetName}` : ''
  const suffix = effectNote ? ` — ${effectNote}` : ''
  return `causou ${damage.total} de dano${alvo}${suffix}`
}

export function formatSpell(spellName: string, result: SpellCastResult, effect?: string, targetName?: string): string {
  const base = formatCheck({ ...result.check, label: `Feitiço: ${spellName} (-${result.pvCost} PV)` })
  if (result.curse) return `${base} — Maldição! (1d66=${result.curse.d66}) ${result.curse.effect}`
  const alvo = targetName ? ` em ${targetName}` : ''
  if (result.check.success && effect) return `${base} — efeito${alvo}: ${effect}`
  return base
}
