import { formatCheck, formatDamage, formatDamageAndEffect, formatSpell } from './format'
import { attackRoll, attributeTest, castSpell, damageRoll } from './mechanics'
import { addLogEntry, addSecretRoll, createRollRequest, updateCharacter, updateRollRequest } from './store'
import type { Character, GameTable, LogKind, RollRequest, RollRequestKind } from '../types'

export interface RollIntent {
  kind: RollRequestKind
  description: string
  attrKey?: RollRequest['attrKey']
  attrMod?: number
  skillBonus?: number
  skillName?: string
  target?: number
  spellName?: string
  spellCost?: number
  weaponLabel?: string
  weaponDano?: string
  damageAttrMod?: number
  spellEffect?: string
}

/**
 * O jogador pede uma rolagem. Se a mesa exige aprovação, cria um pedido para o
 * Mestre liberar; caso contrário a rolagem acontece na hora.
 * Retorna o id do pedido quando ficou pendente.
 */
export async function requestRoll(
  table: GameTable,
  character: Character,
  uid: string,
  intent: RollIntent,
): Promise<{ pendingId?: string }> {
  if (!table.requireApproval) {
    await executeRoll(table, character, intent, { actorType: 'player' })
    return {}
  }
  const pendingId = await createRollRequest(table.id, {
    characterId: character.id,
    characterName: character.name,
    requesterUid: uid,
    kind: intent.kind,
    description: intent.description,
    attrKey: intent.attrKey,
    attrMod: intent.attrMod,
    skillBonus: intent.skillBonus,
    skillName: intent.skillName,
    target: intent.target,
    spellName: intent.spellName,
    spellCost: intent.spellCost,
    weaponLabel: intent.weaponLabel,
    weaponDano: intent.weaponDano,
    damageAttrMod: intent.damageAttrMod,
    spellEffect: intent.spellEffect,
  })
  return { pendingId }
}

export interface RollOutcome {
  summary: string
  dice: number[]
  total: number
  success?: boolean
  kind: LogKind
}

/** Executa de fato a rolagem e registra no log da mesa (visível a todos). */
export async function executeRoll(
  table: GameTable,
  character: Character,
  intent: RollIntent,
  opts: { actorType: 'player' | 'gm'; secret?: boolean },
): Promise<RollOutcome> {
  const attrMod = intent.attrMod ?? 0
  const skillBonus = intent.skillBonus ?? 0
  let outcome: RollOutcome

  if (intent.kind === 'attribute_test') {
    const check = attributeTest({
      attrMod,
      skillBonus,
      difficulty: intent.target ?? 13,
      label: intent.description || 'Teste de Atributo',
    })
    outcome = { summary: formatCheck(check), dice: check.roll.rolls, total: check.total, success: check.success, kind: 'attribute_test' }
  } else if (intent.kind === 'attack') {
    const check = attackRoll({
      attrMod,
      skillBonus,
      targetDefense: intent.target ?? 10,
      label: intent.description || 'Ataque',
    })
    let summary = formatCheck(check)
    // Ataque bem-sucedido com uma arma conhecida: já rola o dano na hora e
    // narra o resultado na mesma mensagem, sem precisar de um segundo passo.
    if (check.success && intent.weaponDano) {
      const dmg = damageRoll({
        weaponDano: intent.weaponDano,
        attrMod: intent.damageAttrMod ?? 0,
        weaponLabel: intent.weaponLabel,
      })
      summary += ` — ${formatDamageAndEffect(dmg)}`
    }
    outcome = { summary, dice: check.roll.rolls, total: check.total, success: check.success, kind: 'attack' }
  } else if (intent.kind === 'spell') {
    const result = castSpell({
      attrMod,
      skillBonus,
      pvCost: intent.spellCost ?? 0,
      label: `Feitiço: ${intent.spellName ?? ''}`,
    })
    outcome = {
      summary: formatSpell(intent.spellName ?? 'Feitiço', result, intent.spellEffect),
      dice: result.check.roll.rolls,
      total: result.check.total,
      success: result.check.success,
      kind: result.curse ? 'curse' : 'spell',
    }
    // O custo em PV é pago independentemente do resultado (pág. 57).
    const newHp = Math.max(0, character.hp.current - (intent.spellCost ?? 0))
    await updateCharacter(table.id, character.id, {
      hp: { ...character.hp, current: newHp },
      isAlive: newHp > 0,
    })
  } else {
    const dmg = damageRoll({
      weaponDano: intent.weaponDano ?? '1d6',
      attrMod: intent.damageAttrMod ?? 0,
      weaponLabel: intent.weaponLabel,
    })
    outcome = { summary: formatDamage(dmg), dice: dmg.roll.rolls, total: dmg.total, kind: 'damage' }
  }

  const entry = {
    actorName: character.name,
    actorType: opts.actorType,
    characterId: character.id,
    kind: outcome.kind,
    summary: outcome.summary,
    rolls: outcome.dice,
    total: outcome.total,
    success: outcome.success,
    dice: outcome.dice,
    diceLabel: intent.description || outcome.kind,
  }
  if (opts.secret) await addSecretRoll(table.id, entry)
  else await addLogEntry(table.id, entry)

  return outcome
}

/** O Mestre libera o pedido: a rolagem acontece e todos veem o resultado. */
export async function approveRollRequest(table: GameTable, request: RollRequest, character: Character) {
  const outcome = await executeRoll(
    table,
    character,
    {
      kind: request.kind,
      description: request.description,
      attrKey: request.attrKey,
      attrMod: request.attrMod,
      skillBonus: request.skillBonus,
      skillName: request.skillName,
      target: request.target,
      spellName: request.spellName,
      spellCost: request.spellCost,
      weaponLabel: request.weaponLabel,
      weaponDano: request.weaponDano,
      damageAttrMod: request.damageAttrMod,
      spellEffect: request.spellEffect,
    },
    { actorType: 'player' },
  )
  await updateRollRequest(table.id, request.id, {
    status: 'approved',
    resolvedAt: Date.now(),
    resultSummary: outcome.summary,
    dice: outcome.dice,
    baseTotal: outcome.total,
    success: outcome.success,
  })
  return outcome
}

/**
 * Gasto de PV depois de ver a rolagem, para alcançar a dificuldade (pág. 39).
 * Não rola dados novos — apenas soma os PV gastos ao total já obtido.
 */
export async function spendHpOnRoll(table: GameTable, request: RollRequest, character: Character, hpSpent: number) {
  if (hpSpent <= 0 || request.baseTotal === undefined) return
  const spent = Math.min(hpSpent, Math.max(0, character.hp.current - 1))
  if (spent <= 0) return
  const finalTotal = request.baseTotal + spent
  const target = request.target ?? 13
  const success = finalTotal >= target
  const newHp = Math.max(0, character.hp.current - spent)

  await updateCharacter(table.id, character.id, {
    hp: { ...character.hp, current: newHp },
    isAlive: newHp > 0,
  })
  await updateRollRequest(table.id, request.id, { hpSpentAfter: spent, finalTotal, success })
  await addLogEntry(table.id, {
    actorName: character.name,
    actorType: 'player',
    characterId: character.id,
    kind: 'hp',
    summary: `gastou ${spent} PV para reforçar a rolagem: ${request.baseTotal} + ${spent} = ${finalTotal} vs ${target} → ${
      success ? 'Sucesso' : 'Ainda fracasso'
    }`,
    total: finalTotal,
    success,
  })
}

export async function denyRollRequest(table: GameTable, request: RollRequest, reason?: string) {
  await updateRollRequest(table.id, request.id, {
    status: 'denied',
    resolvedAt: Date.now(),
    deniedReason: reason,
  })
  await addLogEntry(table.id, {
    actorName: 'Mestre',
    actorType: 'gm',
    kind: 'note',
    summary: `Ação de ${request.characterName} não foi liberada: ${request.description}${reason ? ` — ${reason}` : ''}`,
  })
}
