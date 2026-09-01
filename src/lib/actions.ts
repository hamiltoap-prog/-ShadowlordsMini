import { formatCheck, formatDamage, formatSpell } from './format'
import type { CheckResult, DamageResult, SpellCastResult } from './mechanics'
import { addLogEntry } from './store'
import type { LogKind } from '../types'

interface Actor {
  tableId: string
  actorName: string
  actorType: 'player' | 'gm' | 'system'
  characterId?: string
}

export async function logCheck(actor: Actor, check: CheckResult) {
  await addLogEntry(actor.tableId, {
    actorName: actor.actorName,
    actorType: actor.actorType,
    characterId: actor.characterId,
    kind: check.kind as LogKind,
    summary: formatCheck(check),
    rolls: check.roll.rolls,
    total: check.total,
    success: check.success,
  })
}

export async function logDamage(actor: Actor, damage: DamageResult, targetLabel?: string) {
  await addLogEntry(actor.tableId, {
    actorName: actor.actorName,
    actorType: actor.actorType,
    characterId: actor.characterId,
    kind: 'damage',
    summary: targetLabel ? `${formatDamage(damage)} em ${targetLabel}` : formatDamage(damage),
    rolls: damage.roll.rolls,
    total: damage.total,
  })
}

export async function logSpell(actor: Actor, spellName: string, result: SpellCastResult) {
  await addLogEntry(actor.tableId, {
    actorName: actor.actorName,
    actorType: actor.actorType,
    characterId: actor.characterId,
    kind: result.curse ? 'curse' : 'spell',
    summary: formatSpell(spellName, result),
    rolls: result.check.roll.rolls,
    total: result.check.total,
    success: result.check.success,
  })
}

export async function logNote(actor: Actor, text: string, kind: LogKind = 'note') {
  await addLogEntry(actor.tableId, {
    actorName: actor.actorName,
    actorType: actor.actorType,
    characterId: actor.characterId,
    kind,
    summary: text,
  })
}
