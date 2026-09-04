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
  /** Fonte de luz ativa até este horário (epoch ms) — ilumina a área ao redor
   * do token deste personagem na tela de jogo enquanto durar. */
  lightUntil?: number
}

export interface NPCAttack {
  id: string
  name: string
  dano: string
  note?: string
}

/** Característica livre de uma criatura especial: "Sopro de Cinzas", "Voo", etc. */
export interface NPCTrait {
  id: string
  name: string
  description: string
}

/** Linha livre de ficha: rótulo + valor, para o que não cabe nos campos fixos. */
export interface NPCStat {
  id: string
  label: string
  value: string
}

/**
 * Tamanho da criatura no mapa. `squares` é a medida de verdade — quantos
 * quadrados da grade a criatura ocupa —, e é o que mantém a proporção entre as
 * peças quando o Mestre muda a escala do mapa. `size` (fração da largura do
 * palco) fica como valor de reserva para as peças antigas, feitas antes da
 * grade existir.
 */
export const CREATURE_SIZES = [
  { key: 'normal', label: 'Normal', size: 0.07, squares: 1 },
  { key: 'grande', label: 'Grande', size: 0.11, squares: 2 },
  { key: 'enorme', label: 'Enorme', size: 0.17, squares: 3 },
  { key: 'colossal', label: 'Colossal', size: 0.26, squares: 4 },
] as const

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
  /** 'special' = ficha livre (dragões, entidades, o que fugir das regras). */
  flavor?: 'simple' | 'special'
  /** Título/tipo da criatura especial, ex: "Dragão Ancião das Cinzas". */
  title?: string
  description?: string
  /** Campos livres da ficha, ex: "Envergadura" → "12 metros". */
  customStats?: NPCStat[]
  /** Poderes e características próprias, com descrição. */
  traits?: NPCTrait[]
  /** Tamanho do ícone no mapa (fração da largura do tabuleiro). */
  tokenSize?: number
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
  /** Texto do efeito do feitiço (ex: "3d6 Dano e vítima rola Teste para 1/2
   * Dano"), narrado no resultado quando a conjuração é bem-sucedida. */
  spellEffect?: string
  /** Nome do alvo escolhido no rastreador de combate, quando houver. */
  targetName?: string
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
  size: number // diâmetro relativo à largura do palco (ex: 0.07) — legado
  /** Tamanho em quadrados da grade (1 = criatura média). Quando presente, é
   *  ele que manda: a peça acompanha a escala do mapa automaticamente. */
  squares?: number
  /** Quando ligado a uma ficha (personagem ou NPC), mostra o status ao vivo. */
  refType?: 'character' | 'npc'
  refId?: string
  /** Falso = "preparado" na bandeja do Mestre, ainda fora do mapa visível. */
  onBoard?: boolean
}

export type TimeOfDay = 'day' | 'night'

/**
 * Enquadramento do mapa, definido pelo Mestre e igual para todo mundo.
 *
 * O "palco" é o retângulo onde o mapa vive: ele tem uma proporção fixa
 * (`aspect`), então as coordenadas 0..1 das peças caem exatamente no mesmo
 * ponto do mapa em qualquer tela — é o que faz a visão do jogador bater com a
 * do Mestre. Zoom/rotação/deslocamento movem a *imagem dentro* do palco, o que
 * na prática dá o recorte.
 */
export interface SceneMap {
  /** Rotação da imagem, em graus. */
  rotation?: number
  /** Zoom da imagem dentro do palco (1 = ajustada). */
  zoom?: number
  /** Deslocamento da imagem, em fração da largura/altura do palco. */
  offsetX?: number
  offsetY?: number
  /** Proporção largura/altura do palco. É o recorte visível do mapa. */
  aspect?: number
  /** 'contain' mostra a imagem inteira; 'cover' preenche o palco, recortando. */
  fit?: 'contain' | 'cover'
}

/** Proporção do palco quando o Mestre ainda não ajustou nada. */
export const DEFAULT_STAGE_ASPECT = 16 / 10
/** Largura do mapa em quadrados quando o Mestre ainda não definiu a escala. */
export const DEFAULT_GRID_COLUMNS = 20

export interface Scene {
  backgroundUrl: string
  tokens: SceneToken[]
  /** Quando falso, os jogadores veem uma tela de espera enquanto o Mestre prepara a cena. */
  revealed: boolean
  updatedAt: number
  /** Dia ou noite — controla o tom ambiente e se o local escurece. */
  timeOfDay?: TimeOfDay
  /** O Mestre decide manualmente se o local atual está iluminado (tochas,
   * velas, luz do dia entrando) — independe do dia/noite: útil tanto para um
   * cômodo escuro durante o dia quanto para um salão iluminado à noite. */
  locationLit?: boolean
  /** Enquadramento do mapa — o mesmo para o Mestre e para os jogadores. */
  map?: SceneMap
  /** Escala: quantos quadrados de largura o mapa tem. Um mapa grande usa mais
   *  quadrados, e as peças ficam menores na mesma proporção. */
  gridColumns?: number
  /** Desenha a malha de quadrados por cima do mapa. */
  showGrid?: boolean
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
