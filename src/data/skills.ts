// Lista de Habilidades — Manual de Regras, pág. 48-51
export interface SkillDef {
  d66: string
  name: string
  description: string
  bonusType?: 'teste' | 'ataque'
}

export const SKILLS: SkillDef[] = [
  { d66: '11', name: 'Arremesso', description: 'Adicione +1 à rolagem de Ataque toda vez que tentar acertar um oponente com alguma arma do tipo Arremesso.', bonusType: 'ataque' },
  { d66: '12', name: 'Ataque Duplo', description: 'Faça a rolagem de Ataque duas vezes.' },
  { d66: '13', name: 'Caça', description: 'Você pode construir armadilhas simples e preparar a caça para alimento.' },
  { d66: '14', name: 'Combate', description: 'Adicione +1 à rolagem de Ataque toda vez que tentar acertar um oponente com alguma arma do tipo Combate.', bonusType: 'ataque' },
  { d66: '15', name: 'Conhecimento', description: 'Você é capaz de compreender assuntos específicos com profundidade considerável.' },
  { d66: '16', name: 'Construção', description: 'Você sabe como planejar e executar projetos de habitações, fortificações ou excavações.' },
  { d66: '21', name: 'Cura', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar curar ferimentos. Caso obtenha sucesso, a vítima recupera até 1d3+3 Pontos de Vida.', bonusType: 'teste' },
  { d66: '22', name: 'Diplomacia', description: 'Você sabe como conduzir situações delicadas com sensatez.' },
  { d66: '23', name: 'Erudição', description: 'Você é capaz de ler e escrever textos simples.' },
  { d66: '24', name: 'Escalada', description: 'Você pode subir superfícies íngremes.' },
  { d66: '25', name: 'Exploração', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar encontrar algo nos ermos.', bonusType: 'teste' },
  { d66: '26', name: 'Feitiçaria', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar conjurar um feitiço.', bonusType: 'teste' },
  { d66: '31', name: 'Furtividade', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar se esconder ou mover-se silenciosamente.', bonusType: 'teste' },
  { d66: '32', name: 'Herbalismo', description: 'Você sabe onde buscar ervas e preparar antídotos e remédios.' },
  { d66: '33', name: 'Idioma', description: 'Você conhece outras línguas e pode se comunicar em outros idiomas.' },
  { d66: '34', name: 'Intimidação', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar amedrontar ou subjugar alguém.', bonusType: 'teste' },
  { d66: '35', name: 'Lábia', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar enganar outras pessoas.', bonusType: 'teste' },
  { d66: '36', name: 'Ladinagem', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar abrir fechaduras, desarmar armadilhas ou furtar alguém.', bonusType: 'teste' },
  { d66: '41', name: 'Lei', description: 'Você conhece códigos penais.' },
  { d66: '42', name: 'Liderança', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar comandar outras pessoas.', bonusType: 'teste' },
  { d66: '43', name: 'Luta', description: 'Adicione +1 à rolagem de Ataque toda vez que tentar acertar um oponente com alguma arma do tipo Luta.', bonusType: 'ataque' },
  { d66: '44', name: 'Manha', description: 'Você pode resolver embaraços através de subterfúgios ou contatos.' },
  { d66: '45', name: 'Montaria', description: 'Você sabe conduzir animais.' },
  { d66: '46', name: 'Navegação', description: 'Você conduz embarcações.' },
  { d66: '51', name: 'Negociação', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar barganhar.', bonusType: 'teste' },
  { d66: '52', name: 'Observação', description: 'Você pode notar detalhes.' },
  { d66: '53', name: 'Ocultismo', description: 'Você pode compreender assuntos obscuros de natureza mística.' },
  { d66: '54', name: 'Ofício', description: 'Você é capaz de executar um trabalho específico ou especializado.' },
  { d66: '55', name: 'Persuasão', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar convencer outras pessoas.', bonusType: 'teste' },
  { d66: '56', name: 'Pontaria', description: 'Adicione +1 à rolagem de Ataque toda vez que tentar acertar um oponente com alguma arma do tipo Pontaria.', bonusType: 'ataque' },
  { d66: '61', name: 'Prontidão', description: 'Você age primeiro no Ataque e raramente é surpreendido.' },
  { d66: '62', name: 'Rastreio', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar encontrar rastros.', bonusType: 'teste' },
  { d66: '63', name: 'Religião', description: 'Você conhece ritos e crenças de natureza divina.' },
  { d66: '64', name: 'Resistência', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que estiver sob esforço fora do comum ou sob ação de veneno/substância tóxica.', bonusType: 'teste' },
  { d66: '65', name: 'Sobrevivência', description: 'Adicione +1 à rolagem de Teste de Atributo toda vez que tentar encontrar abrigo nos ermos.', bonusType: 'teste' },
  { d66: '66', name: 'Tradição', description: 'Você conhece costumes, lendas e profecias de um povo.' },
]

export function skillByD66(code: string): SkillDef | undefined {
  return SKILLS.find((s) => s.d66 === code)
}
