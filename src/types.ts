// Tipos centrais do sistema Shadowlords Mini System (3a Edição)

export const ATTRIBUTE_KEYS = ['for', 'agi', 'sau', 'int', 'sab', 'per'] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  for: 'Força',
  agi: 'Agilidade',
  sau: 'Saúde',
  int: 'Inteligência',
  sab: 'Sabedoria',
  per: 'Personalidade',
}

export interface AttributeScore {
  score: number
  mod: number
}

export type Attributes = Record<AttributeKey, AttributeScore>

export interface InventoryItem {
  id: string
  name: string
  qty: number
  note?: string
}

export interface CarriedWeapon {
  id: string
  name: string
  dano: string // notação de dado, ex: "2d6"
  habilidade?: string
  tipo?: string
  equipped: boolean
}

export interface CarriedArmor {
  id: string
  name: string
  defesaBonus: number
  protecao?: string
  equipped: boolean
}

export interface CharacterSkill {
  name: string
  description?: string
}

export interface Character {
  id: string
  tableId: string
  ownerUid: string
  playerNickname: string
  name: string
  occupation: string
  origin: string
  attributes: Attributes
  hp: { current: number; max: number }
  defense: number
  baseDefense: number
  skills: CharacterSkill[]
  weapons: CarriedWeapon[]
  armor: CarriedArmor[]
  equipment: InventoryItem[]
  gold: number
  xp: number
  xpSpent: number
  notes: string
  portraitEmoji?: string
  createdAt: number
  updatedAt: number
  isAlive: boolean
}

export interface NPCAttack {
  id: string
  name: string
  dano: string
  note?: string
}

export interface NPC {
  id: string
  tableId: string
  name: string
  defense: number
  hp: { current: number; max: number }
  attacks: NPCAttack[]
  sourceLabel?: string
  notes?: string
  visible: boolean
  createdAt: number
}

export interface GameTable {
  id: string
  code: string
  name: string
  gmUid: string
  gmNickname: string
  createdAt: number
  combatActive: boolean
  combatOrder: string[] // ids: `char:<id>` ou `npc:<id>`
  combatTurnIndex: number
}

export type LogKind =
  | 'attribute_test'
  | 'attack'
  | 'damage'
  | 'spell'
  | 'curse'
  | 'note'
  | 'xp'
  | 'hp'
  | 'table'
  | 'random_table'

export interface LogEntry {
  id: string
  tableId: string
  ts: number
  actorName: string
  actorType: 'player' | 'gm' | 'system'
  characterId?: string
  kind: LogKind
  summary: string
  rolls?: number[]
  total?: number
  success?: boolean
}
