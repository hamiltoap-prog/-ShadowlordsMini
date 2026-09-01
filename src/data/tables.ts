// Tabelas diversas do Apêndice: Tesouros (pág. 76), Achados (pág. 77),
// Exploração de Ermos (pág. 78) e Pontos de Experiência (pág. 63)

export interface RollTable {
  title: string
  dice: string // '1d6' | '1d66'
  entries: string[] // índice 0 = primeiro resultado
}

export const TESOURO_TIPO: RollTable = {
  title: 'Tesouro - Tipo',
  dice: '1d6',
  entries: ['Moedas', 'Gemas', 'Joias', 'Pergaminhos', 'Objetos Mágicos', 'Artefatos de Poder'],
}

export const TESOURO_MOEDAS: RollTable = {
  title: 'Moedas',
  dice: '1d6',
  entries: ['3d6 moedas', '6d6 moedas', '1d6x10 moedas', '3d6x10 moedas', '1d6x100 moedas', '3d6x100 moedas'],
}

export const TESOURO_GEMAS: RollTable = {
  title: 'Gemas',
  dice: '1d6',
  entries: ['Opala', 'Esmeralda', 'Ametista', 'Rubi', 'Turquesa', 'Safira'],
}

export const TESOURO_JOIAS: RollTable = {
  title: 'Joias',
  dice: '1d6',
  entries: [
    'Alfinete, Broche ou Fivela', 'Bracelete, Tornozeleira ou Cinto',
    'Pulseira, Brinco ou Gargantilha', 'Anel, Colar ou Pingente',
    'Amuleto, Tiara ou Diadema', 'Cetro, Coroa ou Medalhão',
  ],
}

export const TESOURO_PERGAMINHOS: RollTable = {
  title: 'Pergaminhos',
  dice: '1d6',
  entries: [
    'Proteção Contra Feitiços', 'Proteção Contra Mortos-Vivos', 'Proteção Contra Filhos de Skandir',
    'Proteção Contra Demônios', 'Forma Animal', 'Forma Gasosa',
  ],
}

export const TESOURO_OBJETOS_MAGICOS: RollTable = {
  title: 'Objetos Mágicos',
  dice: '1d6',
  entries: [
    'Poção de Cura (1d6+6 PV)', 'Poção de Invisibilidade', 'Poção de Forma Gasosa',
    'Varinha de Raios Mágicos', 'Varinha de Remover Magia', 'Cajado de Ressuscitar Mortos',
  ],
}

export const TESOURO_ARTEFATOS: RollTable = {
  title: 'Artefatos de Poder',
  dice: '1d6',
  entries: [
    'Anel de Proteção (Defesa +2)', 'Elmo de Telepatia', 'Arma Mágica (Dano +1)',
    'Escudo Mágico (Defesa +1)', 'Bracelete de Força (Dano +2)', 'Medalhão de Teletransporte',
  ],
}

export const ACHADOS: RollTable = {
  title: 'Achados',
  dice: '1d66',
  entries: [
    'Dente de prata', 'Falange amputada', 'Escalpo ruivo', 'Crânio esmagado', 'Osso carbonizado', 'Mão decepada',
    'Pena de corvo', 'Pele de coelho', 'Ovo de coruja', 'Cesta de palha', 'Corda de crina trançada', 'Martelo enferrujado',
    'Faca sem fio', 'Lâmina partida', 'Saco rasgado', 'Bolsa furada', 'Capa empoeirada', 'Bota sem par',
    'Pele de alce', 'Pele de lobo', 'Pele de urso', 'Manto de lã púrpura', 'Estatueta de bronze antiga', 'Pedaço de vidro azul',
    'Adaga de prata', 'Anel de ferro', 'Vaso de porcelana fina', 'Corrente de prata', 'Cálice de bronze', 'Manuscrito religioso',
    'Pergaminho mágico', 'Grimório de feitiços', 'Símbolo sagrado antigo', 'Saco com joias', 'Baú com tesouros sortidos', 'Objeto amaldiçoado, role 1d66 na Maldição',
  ],
}

export const ERMOS_TIPO: RollTable = { title: 'Tipo de Terreno', dice: '1d6', entries: ['Deserto', 'Planície', 'Pântano', 'Colina', 'Floresta', 'Montanha'] }
export const ERMOS_CLIMA: RollTable = { title: 'Clima', dice: '1d6', entries: ['Seco', 'Quente', 'Frio', 'Nublado', 'Rigoroso', 'Ameno'] }
export const ERMOS_CONDICAO: RollTable = { title: 'Condição do Local', dice: '1d6', entries: ['Completamente abandonado(a)', 'Totalmente arruinado(a)', 'Aparentemente desabitado(a)', 'Parcialmente destruído(a)', 'Estranhamente desolado(a)', 'Aparentemente habitado(a)'] }
export const ERMOS_AVISTAMENTOS: RollTable = { title: 'Avistamentos', dice: '1d6', entries: ['Aves carniceiras no céu', 'Animais de rebanho no local', 'Enxames de insetos no ar', 'Estranhos brilhos reluzentes', 'Sinais de fumaça nos arredores', 'Marcas de incêndio recente'] }
export const ERMOS_SITUACAO_PRINCIPAL: RollTable = { title: 'Situação Principal', dice: '1d6', entries: ['Clima muda abruptamente', 'Sons ecoam pelos arredores', 'Sangue encontrado no local', 'Cheiro fétido trazido pelo vento', 'Ossos espalhados pelo lugar', 'Tremores são sentidos na região'] }
export const ERMOS_VESTIGIOS: RollTable = { title: 'Vestígios', dice: '1d6', entries: ['Buracos', 'Pedras', 'Menires', 'Dólmens', 'Túmulos', 'Sepulturas'] }
export const ERMOS_MARCOS: RollTable = { title: 'Marcos', dice: '1d6', entries: ['Torre', 'Minarete', 'Forte', 'Templo', 'Aldeia', 'Cemitério'] }
export const ERMOS_SITUACAO_COMPLEMENTAR: RollTable = { title: 'Situação Complementar', dice: '1d6', entries: ['Estrondo grave e abafado', 'Relâmpago de brilho ofuscante', 'Grito súbito e estridente', 'Estalo leve e incessante', 'Rastro úmido e pegajoso', 'Excremento e urina'] }

export const XP_TABLE: { xp: number; label: string }[] = [
  { xp: 1, label: '+1 Ponto de Vida (máximo)' },
  { xp: 2, label: '+1 Habilidade' },
  { xp: 3, label: '+1 em Defesa' },
  { xp: 4, label: '+1 em qualquer Atributo' },
  { xp: 5, label: '+1 em qualquer Modificador de Atributo' },
]

export const ORACLE_YES_NO = ['Sim', 'Sim', 'Sim', 'Não', 'Não', 'Não'] // 1-3 Sim, 4-6 Não
