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

export function formatDamage(damage: DamageResult): string {
  const dice = damage.roll.rolls.length ? `[${damage.roll.rolls.join(', ')}]` : ''
  const modPart = damage.attrMod ? ` ${damage.attrMod >= 0 ? '+' : ''}${damage.attrMod}` : ''
  return `Dano (${damage.weaponLabel}): ${damage.roll.notation} ${dice}${modPart} = ${damage.total}`
}

export function formatSpell(spellName: string, result: SpellCastResult): string {
  const base = formatCheck({ ...result.check, label: `Feitiço: ${spellName} (-${result.pvCost} PV)` })
  if (!result.curse) return base
  return `${base} — Maldição! (1d66=${result.curse.d66}) ${result.curse.effect}`
}
