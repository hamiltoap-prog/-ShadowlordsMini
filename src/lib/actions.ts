import { addCharacterXp, addLogEntry } from './store'
import type { Character, LogKind } from '../types'

interface Actor {
  tableId: string
  actorName: string
  actorType: 'player' | 'gm' | 'system'
  characterId?: string
}

/**
 * Registra um evento simples no log da mesa (dano recebido, cura, XP gasto,
 * compras, avisos do Mestre). Rolagens de dados passam por `lib/rollFlow`.
 */
export async function logNote(actor: Actor, text: string, kind: LogKind = 'note') {
  await addLogEntry(actor.tableId, {
    actorName: actor.actorName,
    actorType: actor.actorType,
    characterId: actor.characterId,
    kind,
    summary: text,
  })
}

/**
 * O Mestre dá (ou tira) XP de um personagem e a mesa vê no registro. Tirar
 * nunca deixa o XP disponível abaixo de zero.
 */
export async function awardXp(
  tableId: string,
  character: Pick<Character, 'id' | 'name' | 'xp'>,
  amount: number,
  reason = '',
) {
  if (!amount) return
  const why = reason.trim() ? ` — ${reason.trim()}` : ''
  if (amount > 0) {
    await addCharacterXp(tableId, character.id, amount)
  } else {
    const taken = Math.min(character.xp, -amount)
    if (taken === 0) return
    await addCharacterXp(tableId, character.id, -taken)
    amount = -taken
  }
  await logNote(
    { tableId, actorName: 'Mestre', actorType: 'gm', characterId: character.id },
    amount > 0 ? `⭐ ${character.name} recebeu ${amount} XP${why}` : `⭐ ${character.name} perdeu ${-amount} XP${why}`,
    'xp',
  )
}
