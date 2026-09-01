// Origem — Manual de Regras, pág. 47 (role 1d66)
// Habilidades: Modificador de Sabedoria + 1, escolha uma das opções listadas
export interface OriginDef {
  d66: string
  name: string
  habilidades: string[]
}

export const ORIGINS: OriginDef[] = [
  { d66: '11-12', name: 'Leste Distante', habilidades: ['Conhecimento', 'Feitiçaria', 'Herbalismo', 'Idioma', 'Luta'] },
  { d66: '13-14', name: 'Ermos de Skandia', habilidades: ['Caça', 'Escalada', 'Luta', 'Resistência', 'Tradição'] },
  { d66: '15-16', name: 'Minas de Orgorost', habilidades: ['Construção', 'Intimidação', 'Luta', 'Ofício', 'Resistência'] },
  { d66: '21-22', name: 'Aldeia de Tarkar', habilidades: ['Caça', 'Luta', 'Observação', 'Prontidão', 'Rastreio'] },
  { d66: '23-24', name: 'Cidadela de Zimbar', habilidades: ['Furtividade', 'Lábia', 'Ladinagem', 'Luta', 'Prontidão'] },
  { d66: '25-26', name: 'Costa da Serpente', habilidades: ['Caça', 'Combate', 'Exploração', 'Luta', 'Navegação'] },
  { d66: '31-32', name: 'Planícies Amarelas', habilidades: ['Caça', 'Feitiçaria', 'Luta', 'Montaria', 'Sobrevivência'] },
  { d66: '33-34', name: 'Reino de Rhuran', habilidades: ['Diplomacia', 'Lei', 'Liderança', 'Luta', 'Negociação'] },
  { d66: '35-36', name: 'Terras de Nimir', habilidades: ['Cura', 'Liderança', 'Luta', 'Ofício', 'Religião'] },
  { d66: '41-42', name: 'Estepes de Kulgur', habilidades: ['Arremesso', 'Luta', 'Montaria', 'Pontaria', 'Rastreio'] },
  { d66: '43-44', name: 'Cidadela de Tashar', habilidades: ['Feitiçaria', 'Luta', 'Manha', 'Ocultismo', 'Persuasão'] },
  { d66: '45-46', name: 'Cidadela de Galaris', habilidades: ['Erudição', 'Idioma', 'Luta', 'Negociação', 'Ofício'] },
  { d66: '51-52', name: 'Cidadela de Nuvar', habilidades: ['Ataque Duplo', 'Combate', 'Intimidação', 'Luta', 'Religião'] },
  { d66: '53-54', name: 'Colinas de Fergen', habilidades: ['Arremesso', 'Furtividade', 'Ladinagem', 'Luta', 'Pontaria'] },
  { d66: '55-56', name: 'Cidadela de Udhum', habilidades: ['Feitiçaria', 'Luta', 'Ocultismo', 'Persuasão', 'Religião'] },
  { d66: '61-62', name: 'Terras de Voskur', habilidades: ['Arremesso', 'Caça', 'Exploração', 'Luta', 'Resistência'] },
  { d66: '63-64', name: 'Norte Gélido', habilidades: ['Caça', 'Luta', 'Navegação', 'Resistência', 'Sobrevivência'] },
  { d66: '65-66', name: 'Sul Escaldante', habilidades: ['Feitiçaria', 'Luta', 'Persuasão', 'Pontaria', 'Religião'] },
]
