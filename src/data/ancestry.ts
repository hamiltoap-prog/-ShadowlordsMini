import type { AncestryKey } from '../types'

export interface AncestryDef {
  key: AncestryKey
  name: string
  title: string
  description: string
}

// Ancestralidades — conteúdo definido pelo grupo (regra da casa), não faz
// parte do Manual de Regras original do Shadowlords Mini System.
export const ANCESTRIES: AncestryDef[] = [
  {
    key: 'anao',
    name: 'Anão',
    title: 'Robusto',
    description: 'Começa com +2 Pontos de Vida. Rola os Pontos de Vida iniciais com vantagem (rola duas vezes e fica com o maior resultado).',
  },
  {
    key: 'elfo',
    name: 'Elfo',
    title: 'Visão Longínqua',
    description: '+1 em ataques com armas de longo alcance (Pontaria) OU +1 em testes de conjuração — escolha um dos dois ao criar o personagem.',
  },
  {
    key: 'goblin',
    name: 'Goblin',
    title: 'Sentidos Aguçados',
    description: 'Não pode ser surpreendido.',
  },
  {
    key: 'meio-orc',
    name: 'Meio-Orc',
    title: 'Poderoso',
    description: '+1 em rolagens de ataque e de dano com armas de combate corpo a corpo (Combate ou Luta).',
  },
  {
    key: 'halfling',
    name: 'Halfling',
    title: 'Furtivo',
    description: 'Uma vez por dia, pode ficar invisível por 3 rodadas.',
  },
  {
    key: 'humano',
    name: 'Humano',
    title: 'Ambicioso',
    description: 'Ganha uma Habilidade adicional na criação do personagem.',
  },
]

export function ancestryByKey(key?: AncestryKey): AncestryDef | undefined {
  return ANCESTRIES.find((a) => a.key === key)
}
