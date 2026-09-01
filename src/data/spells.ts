import { d66ToIndex36 } from '../lib/dice'

// Grimório de Absay Ashay — Manual de Regras, pág. 58-59
export interface SpellDef {
  name: string
  custo: number
  efeito: string
}

export const SPELLS: SpellDef[] = [
  { name: 'Afastar Mortos-Vivos', custo: 1, efeito: 'Afasta Mortos-Vivos por até 1d6 minutos' },
  { name: 'Banimento', custo: 3, efeito: 'Afasta Demônios por até 1d6 minutos' },
  { name: 'Benção', custo: 1, efeito: 'Torna uma arma mágica por até 1d6 minutos' },
  { name: 'Bola de Fogo', custo: 3, efeito: '3d6 Dano e vítima rola Teste para 1/2 Dano' },
  { name: 'Chave Mágica', custo: 2, efeito: 'Abre uma fechadura ou um cadeado' },
  { name: 'Cura', custo: 2, efeito: 'Restaura até 1d6+6 Pontos de Vida' },
  { name: 'Detecção', custo: 1, efeito: 'Detecta feitiçaria ou objetos mágicos' },
  { name: 'Encanto', custo: 1, efeito: 'Vítima obedece uma sugestão simples' },
  { name: 'Escudo Mágico', custo: 2, efeito: 'Reduz até 1d6+6 Dano por até 1d6 minutos' },
  { name: 'Estilha de Gelo', custo: 3, efeito: '3d6 Dano e vítima rola Teste para 1/2 Dano' },
  { name: 'Fechadura Mágica', custo: 2, efeito: 'Tranca uma fechadura ou um cadeado' },
  { name: 'Flecha Mágica', custo: 1, efeito: 'Dispara uma flecha mágica (1d6 Dano)' },
  { name: 'Forma Animal', custo: 4, efeito: 'Forma de pequeno animal por até 1d6 horas' },
  { name: 'Forma Gasosa', custo: 3, efeito: 'Forma de névoa por até 1d6 minutos' },
  { name: 'Fúria', custo: 1, efeito: 'Adiciona 1d3 Dano por até 1d6 minutos' },
  { name: 'Ilusão', custo: 1, efeito: 'Cria um som ou uma imagem ilusória' },
  { name: 'Imunidade', custo: 3, efeito: 'Concede imunidade a venenos por até 1d6 horas' },
  { name: 'Invisibilidade', custo: 2, efeito: 'Permanece invisível por até 1d6 minutos' },
  { name: 'Levitação', custo: 2, efeito: 'Levita até 1d6+6 metros acima do chão' },
  { name: 'Luz', custo: 1, efeito: 'Cria uma fonte de luz por até 1d6 horas' },
  { name: 'Paralisia', custo: 2, efeito: 'Paralisa um oponente por até 1d6 minutos' },
  { name: 'Petrificação', custo: 5, efeito: 'Transforma um oponente em pedra' },
  { name: 'Portal Mágico', custo: 4, efeito: 'Cria passagem para até 1d6 quilômetros além' },
  { name: 'Proteção', custo: 1, efeito: 'Reduz até 1d3+3 Dano por até 1d6 minutos' },
  { name: 'Raio da Morte', custo: 6, efeito: 'Provoca morte súbita rolando 1-5 em 1d6' },
  { name: 'Raio Mágico', custo: 2, efeito: 'Dispara até 1d2+2 raios mágicos (1d3 Dano cada)' },
  { name: 'Relâmpago', custo: 3, efeito: '3d6 Dano e vítima rola Teste para 1/2 Dano' },
  { name: 'Remover Magia', custo: 3, efeito: 'Remove um efeito mágico' },
  { name: 'Remover Maldição', custo: 5, efeito: 'Remove o efeito de uma maldição' },
  { name: 'Remover Paralisia', custo: 2, efeito: 'Remove um efeito paralisante' },
  { name: 'Remover Veneno', custo: 2, efeito: 'Remove um efeito venenoso' },
  { name: 'Ressuscitar Mortos', custo: 6, efeito: 'Recupera vítima morta até 1d6 dias atrás' },
  { name: 'Silêncio', custo: 1, efeito: 'Cria área silenciosa com 1d6 metros de diâmetro' },
  { name: 'Sono', custo: 1, efeito: 'Provoca um sono leve na vítima' },
  { name: 'Teia Mágica', custo: 2, efeito: 'Cria área pegajosa com 1d6 metros de diâmetro' },
  { name: 'Telepatia', custo: 3, efeito: 'Comunicação telepática por até 3d6 quilômetros' },
]

// Maldição — pág. 61. Ao falhar num Teste de Feitiçaria, role 1d66.
export interface CurseDef {
  d66: string
  effect: string
}

export const CURSES: CurseDef[] = [
  { d66: '11-12', effect: 'Seu corpo apodrece lentamente, sofrendo 1d3 Dano por dia' },
  { d66: '13-14', effect: 'Seus olhos se tornam turvos e leitosos, dificultando sua visão' },
  { d66: '15-16', effect: 'Você é atingido por uma explosão incendiária, sofrendo 1d6 Dano' },
  { d66: '21-22', effect: 'Seu paladar se torna fraco e insosso, dificultando sua alimentação' },
  { d66: '23-24', effect: 'Você é transformado em (1d6): 1-3 um corvo ou 4-6 uma coruja' },
  { d66: '25-26', effect: 'Um par de chifres pesados e pontiagudos surgem da sua cabeça' },
  { d66: '31-32', effect: 'Seu corpo sofre uma paralisia duradoura e você é incapaz de se mover' },
  { d66: '33-34', effect: 'Toque de Ashaza: seu Modificador de Inteligência é reduzido para -1' },
  { d66: '35-36', effect: 'Você é transformado em (1d6): 1-3 uma serpente ou 4-6 um lagarto' },
  { d66: '41-42', effect: 'Uma cabeça demoníaca cresce lentamente do seu ombro direito' },
  { d66: '43-44', effect: 'Sopro de Vartha: seu Modificador de Sabedoria é reduzido para -1' },
  { d66: '45-46', effect: 'Você fica confuso e incapaz de lançar feitiços por até 1d6 dias' },
  { d66: '51-52', effect: 'Você conjura um Morto-Vivo – Sombra Dominadora' },
  { d66: '53-54', effect: 'Olhar de Borka: seu Modificador de Personalidade é reduzido para -1' },
  { d66: '55-56', effect: 'Você conjura uma Besta Demoníaca – Nebelor' },
  { d66: '61-62', effect: 'Você é transformado em (1d6): 1-2 barro, 3-4 carvão ou 5-6 pedra' },
  { d66: '63-64', effect: 'Você conjura um Demônio de Cinzas' },
  { d66: '65-66', effect: 'Você é atingido por um raio mortal, sofrendo 2d6 Dano' },
]

/** roll = valor 1d66 (ex: tens=3,units=4 -> 34). As 36 combinações de d66
 * mapeiam sequencialmente para os 18 pares de Maldição (2 valores por linha). */
export function curseByD66(roll: number): CurseDef {
  const index36 = d66ToIndex36(roll)
  const idx = Math.min(Math.max(Math.floor(index36 / 2), 0), CURSES.length - 1)
  return CURSES[idx]
}
