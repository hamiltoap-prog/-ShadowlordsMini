// Ocupação — Manual de Regras, pág. 46 (role 1d66)
export interface OccupationDef {
  d66: string
  name: string
  arma: string
  habilidade: string
}

export const OCCUPATIONS: OccupationDef[] = [
  { d66: '11-12', name: 'Bandido(a) de Cidadelas', arma: 'Faca', habilidade: 'Ladinagem e Luta' },
  { d66: '13-14', name: 'Arqueiro(a) de Muralhas', arma: 'Arco Curto', habilidade: 'Pontaria e Prontidão' },
  { d66: '15-16', name: 'Salteador(a) de Estradas', arma: 'Besta', habilidade: 'Furtividade e Pontaria' },
  { d66: '21-22', name: 'Sentinela de Portões', arma: 'Lança', habilidade: 'Combate e Observação' },
  { d66: '23-24', name: 'Guardião(ã) de Vilarejos', arma: 'Dardo', habilidade: 'Arremesso e Intimidação' },
  { d66: '25-26', name: 'Curandeiro(a) de Aldeias', arma: '—', habilidade: 'Cura e Herbalismo' },
  { d66: '31-32', name: 'Saqueador(a) de Tumbas', arma: 'Porrete', habilidade: 'Exploração e Luta' },
  { d66: '33-34', name: 'Caçador(a) de Bosques', arma: 'Arco Longo', habilidade: 'Caça e Pontaria' },
  { d66: '35-36', name: 'Sacerdote(isa) de Divindades', arma: '—', habilidade: 'Feitiçaria e Religião' },
  { d66: '41-42', name: 'Mercenário(a) de Escaramuças', arma: 'Espada Curta', habilidade: 'Ataque Duplo e Combate' },
  { d66: '43-44', name: 'Lenhador(a) de Florestas', arma: 'Machado', habilidade: 'Luta e Ofício' },
  { d66: '45-46', name: 'Andarilho(a) de Ermos', arma: 'Faca', habilidade: 'Luta e Rastreio' },
  { d66: '51-52', name: 'Adepto(a) de Cultos', arma: '—', habilidade: 'Feitiçaria e Ocultismo' },
  { d66: '53-54', name: 'Peregrino(a) de Templos', arma: '—', habilidade: 'Religião e Sobrevivência' },
  { d66: '55-56', name: 'Vidente de Profecias', arma: '—', habilidade: 'Feitiçaria e Tradição' },
  { d66: '61-62', name: 'Soldado(a) de Batalhas', arma: 'Dardo e Lança', habilidade: 'Arremesso e Combate' },
  { d66: '63-64', name: 'Cavaleiro(a) de Ordens', arma: 'Espada Longa', habilidade: 'Combate e Montaria' },
  { d66: '65-66', name: 'Conjurador(a) de Feitiços', arma: '—', habilidade: 'Erudição e Feitiçaria' },
]
