import { HUNGER_CONDITION, MAX_SUPPLY, THIRST_CONDITION } from '../types'
import type { Character, CharacterCondition, SurvivalState, SurvivalTrack } from '../types'
import { newId } from './id'

/**
 * Fome e sede do grupo.
 *
 * A barra não é um número que alguém precisa lembrar de baixar: ela é sempre
 * calculada a partir de *quando* o grupo comeu ou bebeu pela última vez. Isso
 * mantém tudo certo mesmo com o navegador fechado, e todo mundo vê o mesmo
 * valor sem precisar de ninguém sincronizando nada.
 */

const MINUTE = 60_000

/** Quanto ainda resta da barra, de 1 (saciado) a 0 (privação). */
export function trackRemaining(track: SurvivalTrack, now: number): number {
  const span = Math.max(1, track.intervalMinutes) * MINUTE
  const elapsed = now - track.lastAt
  return Math.min(1, Math.max(0, 1 - elapsed / span))
}

export function isDeprived(track: SurvivalTrack, now: number): boolean {
  return trackRemaining(track, now) <= 0
}

/** Minutos que faltam para a barra zerar (0 quando já zerou). */
export function minutesLeft(track: SurvivalTrack, now: number): number {
  return Math.max(0, Math.ceil((trackRemaining(track, now) * track.intervalMinutes * MINUTE) / MINUTE))
}

/**
 * O grupo comeu ou bebeu: gasta um quarto do suprimento e enche a barra.
 * `lastDamageAt` volta a 0 (e não a `undefined`) de propósito: o `stripUndefined`
 * do store apagaria a chave em vez de zerá-la, e o valor antigo ficaria lá.
 */
export function consume(track: SurvivalTrack, now: number): SurvivalTrack {
  return { ...track, supply: Math.max(0, track.supply - 1), lastAt: now, lastDamageAt: 0 }
}

export function restock(track: SurvivalTrack, delta: number): SurvivalTrack {
  return { ...track, supply: Math.min(MAX_SUPPLY, Math.max(0, track.supply + delta)) }
}

export interface CharacterUpdate {
  characterId: string
  name: string
  patch: Partial<Character>
}

export interface SurvivalEffects {
  characterUpdates: CharacterUpdate[]
  /** Novo estado, quando algum tique de dano foi aplicado. */
  survival?: SurvivalState
  /** Mensagens para o log da mesa. */
  logs: string[]
}

function withCondition(conditions: CharacterCondition[], label: string, note: string): CharacterCondition[] {
  if (conditions.some((c) => c.label === label)) return conditions
  return [...conditions, { id: newId(), label, note, createdAt: Date.now() }]
}

/**
 * Decide o que a privação faz agora: quem ganha ou perde a condição e quem
 * perde PV. Não escreve nada — devolve as mudanças para quem chamou aplicar.
 * Assim o cálculo continua previsível e possível de testar sozinho.
 */
export function computeSurvivalEffects(
  survival: SurvivalState | undefined,
  characters: Character[],
  now: number,
): SurvivalEffects {
  const none: SurvivalEffects = { characterUpdates: [], logs: [] }
  if (!survival?.enabled) return none

  const party = characters.filter((c) => survival.partyIds.includes(c.id))
  if (party.length === 0) return none

  const hungry = isDeprived(survival.hunger, now)
  const thirsty = isDeprived(survival.thirst, now)

  // Dano: cada trilha zerada cobra o seu pedaço, no ritmo definido pelo Mestre.
  // O relógio de cada tique começa no instante em que a barra zerou.
  let damage = 0
  let hunger = survival.hunger
  let thirst = survival.thirst
  const step = Math.max(1, survival.damageMinutes) * MINUTE
  const logs: string[] = []

  function due(track: SurvivalTrack): boolean {
    const zeroedAt = track.lastAt + Math.max(1, track.intervalMinutes) * MINUTE
    return now - (track.lastDamageAt || zeroedAt) >= step
  }

  if (hungry && due(survival.hunger)) {
    damage += Math.max(0, survival.damagePerTick)
    hunger = { ...hunger, lastDamageAt: now }
  }
  if (thirsty && due(survival.thirst)) {
    damage += Math.max(0, survival.damagePerTick)
    thirst = { ...thirst, lastDamageAt: now }
  }

  const characterUpdates: CharacterUpdate[] = []
  for (const c of party) {
    const patch: Partial<Character> = {}

    let conditions = c.conditions ?? []
    if (hungry) conditions = withCondition(conditions, HUNGER_CONDITION, 'Sem comer há tempo demais.')
    if (thirsty) conditions = withCondition(conditions, THIRST_CONDITION, 'Sem beber há tempo demais.')
    if (!hungry) conditions = conditions.filter((x) => x.label !== HUNGER_CONDITION)
    if (!thirsty) conditions = conditions.filter((x) => x.label !== THIRST_CONDITION)
    const conditionsChanged =
      conditions.length !== (c.conditions ?? []).length ||
      conditions.some((x, i) => x.label !== (c.conditions ?? [])[i]?.label)
    if (conditionsChanged) patch.conditions = conditions

    if (damage > 0 && c.hp.current > 0) {
      const current = Math.max(0, c.hp.current - damage)
      patch.hp = { ...c.hp, current }
      patch.isAlive = current > 0
    }

    if (Object.keys(patch).length > 0) characterUpdates.push({ characterId: c.id, name: c.name, patch })
  }

  if (damage > 0 && characterUpdates.some((u) => u.patch.hp)) {
    const motivo = hungry && thirsty ? 'fome e sede' : hungry ? 'fome' : 'sede'
    logs.push(`🥣 O grupo perdeu ${damage} PV por ${motivo}.`)
  }

  return {
    characterUpdates,
    survival: damage > 0 ? { ...survival, hunger, thirst } : undefined,
    logs,
  }
}
