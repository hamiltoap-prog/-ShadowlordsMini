import type { Character, NPC } from '../types'

export type StatusTier = 'ok' | 'hurt' | 'critical'

/** Avariado abaixo de 50% de PV, crítico abaixo de 10% — nunca expõe o número exato. */
export function hpStatusTier(current: number, max: number): StatusTier {
  if (max <= 0) return 'ok'
  const ratio = current / max
  if (ratio <= 0.1) return 'critical'
  if (ratio < 0.5) return 'hurt'
  return 'ok'
}

export interface TokenLiveStatus {
  tier: StatusTier
  conditions: string[]
  isAlive?: boolean
}

/** Busca o status ao vivo (PV/condições) de quem um token da cena representa. */
export function resolveTokenStatus(
  refType: 'character' | 'npc' | undefined,
  refId: string | undefined,
  characters: Character[],
  npcs: NPC[],
): TokenLiveStatus | null {
  if (!refType || !refId) return null
  if (refType === 'character') {
    const c = characters.find((x) => x.id === refId)
    if (!c) return null
    return { tier: hpStatusTier(c.hp.current, c.hp.max), conditions: (c.conditions ?? []).map((cond) => cond.label), isAlive: c.isAlive }
  }
  const n = npcs.find((x) => x.id === refId)
  if (!n) return null
  return { tier: hpStatusTier(n.hp.current, n.hp.max), conditions: [] }
}
