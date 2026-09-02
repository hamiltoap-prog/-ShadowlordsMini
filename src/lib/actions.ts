import { addLogEntry } from './store'
import type { LogKind } from '../types'

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
