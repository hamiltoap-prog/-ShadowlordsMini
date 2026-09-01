// Tabela de Armas e Armaduras — Manual de Regras, pág. 53-54

export interface WeaponDef {
  name: string
  dano: string
  habilidade: string
  tipo: string
  custo: number
}

export const WEAPONS: WeaponDef[] = [
  { name: 'Adaga', dano: '1d6', habilidade: 'Arremesso e Luta', tipo: 'Cortante e Perfurante', custo: 5 },
  { name: 'Arco Curto', dano: '2d6', habilidade: 'Pontaria', tipo: 'Perfurante (Flecha)', custo: 15 },
  { name: 'Arco Longo', dano: '3d6', habilidade: 'Pontaria', tipo: 'Perfurante (Flecha)', custo: 25 },
  { name: 'Arma de Haste', dano: '3d6', habilidade: 'Combate', tipo: 'Perfurante', custo: 20 },
  { name: 'Bastão', dano: '1d6', habilidade: 'Luta', tipo: 'Contundente', custo: 2 },
  { name: 'Besta', dano: '3d6', habilidade: 'Pontaria', tipo: 'Perfurante (Virote)', custo: 30 },
  { name: 'Cajado', dano: '1d6', habilidade: 'Luta', tipo: 'Contundente', custo: 2 },
  { name: 'Chicote', dano: '1d6', habilidade: 'Luta', tipo: 'Contundente e Cortante', custo: 5 },
  { name: 'Clava', dano: '1d6', habilidade: 'Luta', tipo: 'Contundente', custo: 2 },
  { name: 'Clava Grande', dano: '2d6', habilidade: 'Luta', tipo: 'Contundente', custo: 10 },
  { name: 'Clava Gigante', dano: '3d6', habilidade: 'Luta', tipo: 'Contundente', custo: 20 },
  { name: 'Dardo', dano: '1d6', habilidade: 'Arremesso e Luta', tipo: 'Perfurante', custo: 5 },
  { name: 'Espada Curta', dano: '2d6', habilidade: 'Combate', tipo: 'Cortante e Perfurante', custo: 15 },
  { name: 'Espada Longa', dano: '3d6', habilidade: 'Combate', tipo: 'Cortante e Perfurante', custo: 20 },
  { name: 'Faca', dano: '1d6', habilidade: 'Arremesso e Luta', tipo: 'Cortante e Perfurante', custo: 5 },
  { name: 'Funda', dano: '1d6', habilidade: 'Pontaria', tipo: 'Contundente (Pedra)', custo: 2 },
  { name: 'Lança', dano: '2d6', habilidade: 'Combate', tipo: 'Perfurante', custo: 15 },
  { name: 'Lança de Montaria', dano: '3d6', habilidade: 'Combate', tipo: 'Perfurante', custo: 20 },
  { name: 'Maça', dano: '1d6', habilidade: 'Combate', tipo: 'Contundente', custo: 5 },
  { name: 'Machado', dano: '2d6', habilidade: 'Arremesso e Luta', tipo: 'Contundente e Cortante', custo: 10 },
  { name: 'Machado de Batalha', dano: '3d6', habilidade: 'Combate', tipo: 'Contundente e Cortante', custo: 20 },
  { name: 'Martelo', dano: '1d6', habilidade: 'Arremesso e Luta', tipo: 'Contundente', custo: 5 },
  { name: 'Martelo de Guerra', dano: '2d6', habilidade: 'Combate', tipo: 'Contundente', custo: 15 },
  { name: 'Porrete', dano: '1d6', habilidade: 'Luta', tipo: 'Contundente', custo: 2 },
  { name: 'Porrete com Pontas', dano: '2d6', habilidade: 'Luta', tipo: 'Contundente e Perfurante', custo: 10 },
  { name: 'Punhal', dano: '1d6', habilidade: 'Arremesso e Luta', tipo: 'Cortante e Perfurante', custo: 5 },
]

export interface ArmorDef {
  name: string
  defesa: number
  protecao: string
  custo: number
}

export const ARMORS: ArmorDef[] = [
  { name: 'Cota de Malha', defesa: 2, protecao: 'Reduz Dano Cortante e Perfurante em até 1d3+3 por até 1d3+3 vezes*', custo: 150 },
  { name: 'Couraça', defesa: 1, protecao: 'Reduz Dano Cortante em até 1d6 por até 1d3+3 vezes*', custo: 50 },
  { name: 'Escudo Grande', defesa: 1, protecao: 'Reduz Dano Contundente, Cortante e Perfurante em até 1d6 por até 1d3+3 vezes', custo: 60 },
  { name: 'Escudo Pequeno', defesa: 1, protecao: 'Reduz Dano Contundente, Cortante e Perfurante em até 1d3 por até 1d2+2 vezes', custo: 30 },
  { name: 'Peles', defesa: 1, protecao: 'Reduz Dano Cortante em até 1d3 por até 1d2+2 vezes*', custo: 25 },
]

export const ARMOR_NOTE =
  '* Não é capaz de reduzir Dano Contundente como Dano Cortante ou Perfurante. Role 1d6: 1-5 o dano ocorre normalmente, 6 aplique a redução da Proteção ao Dano. Dano mínimo de um ataque com êxito é sempre 1.'

export interface GearDef {
  name: string
  custo: number
}

export const GEAR: GearDef[] = [
  { name: 'Antídoto (para tratar venenos)', custo: 30 },
  { name: 'Bandagem (3 unidades)', custo: 2 },
  { name: 'Bolsa', custo: 2 },
  { name: 'Botas de Viagem', custo: 5 },
  { name: 'Cadeado', custo: 15 },
  { name: 'Capa', custo: 10 },
  { name: 'Cesta', custo: 1 },
  { name: 'Cinto', custo: 2 },
  { name: 'Cinzel (para esculpir pedra)', custo: 2 },
  { name: 'Comida (3 porções)', custo: 1 },
  { name: 'Corda (3 metros)', custo: 1 },
  { name: 'Corrente (1 metro)', custo: 5 },
  { name: 'Elixir (para tratar doenças)', custo: 30 },
  { name: 'Ervas', custo: 5 },
  { name: 'Espelho de Metal', custo: 10 },
  { name: 'Flauta', custo: 5 },
  { name: 'Flechas ou Virotes (6 unidades)', custo: 1 },
  { name: 'Formão (para entalhar madeira)', custo: 2 },
  { name: 'Gancho', custo: 5 },
  { name: 'Gazuas (3 unidades)', custo: 15 },
  { name: 'Harpa', custo: 20 },
  { name: 'Lamparina de Cerâmica', custo: 2 },
  { name: 'Lanterna de Bronze', custo: 10 },
  { name: 'Machadinha', custo: 2 },
  { name: 'Martelete', custo: 2 },
  { name: 'Montaria', custo: 100 },
  { name: 'Odre', custo: 2 },
  { name: 'Óleo (frasco)', custo: 5 },
  { name: 'Pederneira', custo: 5 },
  { name: 'Pedra de Amolar', custo: 2 },
  { name: 'Pergaminho (em branco)', custo: 30 },
  { name: 'Saco', custo: 1 },
  { name: 'Símbolo Sagrado', custo: 20 },
  { name: 'Tocha (3 unidades)', custo: 1 },
  { name: 'Vela', custo: 2 },
  { name: 'Veneno (frasco)', custo: 10 },
]
