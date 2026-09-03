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

export const ANCESTRY_KEYS = ['anao', 'elfo', 'goblin', 'meio-orc', 'halfling', 'humano'] as const
export type AncestryKey = (typeof ANCESTRY_KEYS)[number]

export const ANCESTRY_LABELS: Record<AncestryKey, string> = {
  anao: 'Anão',
  elfo: 'Elfo',
  goblin: 'Goblin',
  'meio-orc': 'Meio-Orc',
  halfling: 'Halfling',
  humano: 'Humano',
}

/** Só o Elfo escolhe entre dois efeitos possíveis da própria característica. */
export type AncestryChoice = 'ranged' | 'spell'

export interface CharacterCondition {
  id: string
  label: string
  note?: string
  createdAt: number
}

export interface Character {
  id: string
  tableId: string
  ownerUid: string
  playerNickname: string
  name: string
  nameLower: string // usado para o jogador reencontrar a ficha pelo nome
  occupation: string
  origin: string
  ancestry?: AncestryKey
  ancestryChoice?: AncestryChoice
  /** Usos gastos hoje do recurso racial do Halfling (Furtivo). Reseta manualmente. */
  racialResourceUsed?: number
  conditions: CharacterCondition[]
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
  portraitUrl?: string
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
  portraitUrl?: string
  visible: boolean
  createdAt: number
}

export interface GameTable {
  id: string
  code: string
  name: string
  gmUid: string
  gmNickname: string
  gmEmail?: string
  createdAt: number
  combatActive: boolean
  combatOrder: string[] // ids: `char:<id>` ou `npc:<id>`
  combatTurnIndex: number
  /** Quando aberta, jogadores podem comprar itens/armas na loja. */
  shopOpen: boolean
  /** Quando ligado, toda rolagem de jogador precisa da aprovação do Mestre. */
  requireApproval: boolean
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
  /** Dados a exibir na animação (valores de cada d6 rolado). */
  dice?: number[]
  /** Rótulo curto mostrado no overlay de dados, ex: "Ataque". */
  diceLabel?: string
}

/** Pedido de rolagem feito por um jogador, aguardando liberação do Mestre. */
export type RollRequestStatus = 'pending' | 'approved' | 'denied'

export type RollRequestKind = 'attribute_test' | 'attack' | 'spell' | 'damage'

export interface RollRequest {
  id: string
  tableId: string
  characterId: string
  characterName: string
  requesterUid: string
  kind: RollRequestKind
  /** Descrição legível da ação pedida, mostrada ao Mestre. */
  description: string
  status: RollRequestStatus
  createdAt: number
  resolvedAt?: number
  resultSummary?: string
  deniedReason?: string
  // Resultado, preenchido quando o Mestre libera a rolagem
  dice?: number[]
  baseTotal?: number
  success?: boolean
  /** PV gastos depois da rolagem para tentar alcançar a dificuldade (pág. 39). */
  hpSpentAfter?: number
  finalTotal?: number
  // Dados necessários para executar a rolagem quando aprovada
  attrKey?: AttributeKey
  attrMod?: number
  skillBonus?: number
  skillName?: string
  target?: number
  spellName?: string
  spellCost?: number
  weaponLabel?: string
  weaponDano?: string
  damageAttrMod?: number
}

export type SceneTokenKind = 'pc' | 'npc' | 'monster' | 'boss'

export const SCENE_TOKEN_LABELS: Record<SceneTokenKind, string> = {
  pc: 'Personagem',
  npc: 'NPC',
  monster: 'Monstro',
  boss: 'Chefe',
}

export interface SceneToken {
  id: string
  label: string
  imageUrl?: string
  kind: SceneTokenKind
  /** Posição relativa ao tabuleiro (0..1), para funcionar em qualquer tela. */
  x: number
  y: number
  size: number // diâmetro relativo à largura do tabuleiro (ex: 0.07)
  /** Quando ligado a uma ficha (personagem ou NPC), mostra o status ao vivo. */
  refType?: 'character' | 'npc'
  refId?: string
  /** Falso = "preparado" na bandeja do Mestre, ainda fora do mapa visível. */
  onBoard?: boolean
}

export interface Scene {
  backgroundUrl: string
  tokens: SceneToken[]
  /** Quando falso, os jogadores veem uma tela de espera enquanto o Mestre prepara a cena. */
  revealed: boolean
  updatedAt: number
}

/** Item salvo na biblioteca da mesa: um mapa ou um preset de token (monstro/NPC/chefe). */
export interface SceneLibraryItem {
  id: string
  kind: 'map' | 'token'
  label: string
  imageUrl?: string
  tokenKind?: SceneTokenKind // presente quando kind === 'token'
  /** Pasta/categoria para organizar mapas na biblioteca (ex: "Masmorras", "Cidades"). */
  folder?: string
  createdAt: number
}

/** Lembra a última imagem usada para um nome de criatura (bestiário ou
 * personalizada), para preencher automaticamente da próxima vez. */
export interface MonsterImageEntry {
  nameLower: string
  name: string
  url: string
  updatedAt: number
}
