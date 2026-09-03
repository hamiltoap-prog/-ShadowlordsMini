// Origem — Manual de Regras, pág. 47 (role 1d66)
// Habilidades: Modificador de Sabedoria + 1, escolha uma das opções listadas
export interface OriginDef {
  d66: string
  name: string
  habilidades: string[]
  /** Trecho do Cenário do manual (pág. 11-17) descrevendo esta região. */
  lore: string
}

const UNDISCOVERED =
  'Pouco se sabe sobre esta região além do que já foi revelado — muitas localidades das Terras Sombrias ainda aguardam para serem descobertas.'

export const ORIGINS: OriginDef[] = [
  {
    d66: '11-12',
    name: 'Leste Distante',
    habilidades: ['Conhecimento', 'Feitiçaria', 'Herbalismo', 'Idioma', 'Luta'],
    lore:
      'Também chamado de Tilung, o Império do Dragão Celestial. Os Tilunganos são amaldiçoados pela feitiçaria demoníaca dos bruxos que dominam seu povo através da brutalidade e da violência de seus exércitos implacáveis.',
  },
  {
    d66: '13-14',
    name: 'Ermos de Skandia',
    habilidades: ['Caça', 'Escalada', 'Luta', 'Resistência', 'Tradição'],
    lore:
      'O Norte Gélido é dominado por uma cadeia de montanhas sombrias chamada Skandia. Ali, escondidos em fendas profundas, vivem os Filhos de Skandir, e os gigantes Voskur habitam seus arredores. Dizem que entre os picos gélidos há uma fortaleza oculta, Khulan Bogyr — o temido covil de Bhaligund, um demônio perverso e traiçoeiro, líder de uma horda de monstruosidades inomináveis.',
  },
  {
    d66: '15-16',
    name: 'Minas de Orgorost',
    habilidades: ['Construção', 'Intimidação', 'Luta', 'Ofício', 'Resistência'],
    lore:
      'Na porção oriental da Costa da Serpente, as Minas de Orgorost ainda aprisionam inúmeras vítimas — um território de exploração e sofrimento nas franjas do mundo conhecido.',
  },
  {
    d66: '21-22',
    name: 'Aldeia de Tarkar',
    habilidades: ['Caça', 'Luta', 'Observação', 'Prontidão', 'Rastreio'],
    lore:
      'Tarkar, uma aldeia ao norte das fartas terras de Nimir, permanece vigilante diante do inimigo que espreita além de suas fronteiras rochosas.',
  },
  {
    d66: '23-24',
    name: 'Cidadela de Zimbar',
    habilidades: ['Furtividade', 'Lábia', 'Ladinagem', 'Luta', 'Prontidão'],
    lore:
      'Um antro de assassinos e ladrões numa cidadela labiríntica de vielas estreitas e escuras. O lugar é infestado de guildas de mercadores corruptos, facções criminosas e cultos secretos de entidades demoníacas — palco de inúmeras vendetas sangrentas.',
  },
  {
    d66: '25-26',
    name: 'Costa da Serpente',
    habilidades: ['Caça', 'Combate', 'Exploração', 'Luta', 'Navegação'],
    lore:
      'Abriga diversas cidades independentes à beira do Mar Gélido, com longa tradição naval de comércio marítimo. A mais conhecida delas, a cidadela de Tashar, foi incendiada pelos Filhos de Skandir e hoje é ocupada pelo bruxo Tzu Lao e seus seguidores.',
  },
  {
    d66: '31-32',
    name: 'Planícies Amarelas',
    habilidades: ['Caça', 'Feitiçaria', 'Luta', 'Montaria', 'Sobrevivência'],
    lore:
      'Uma vasta estepe a leste da Costa da Serpente, ocupada pelos nômades de Kulgur. Cavalgando pelas planícies, eles caçam e enfrentam os odiosos Homens das Colinas e seus mestres de escravos; suas Feiticeiras Zur dominam o fogo e as forças dos elementos naturais.',
  },
  {
    d66: '33-34',
    name: 'Reino de Rhuran',
    habilidades: ['Diplomacia', 'Lei', 'Liderança', 'Luta', 'Negociação'],
    lore:
      'Considerado um lugar relativamente seguro, protegido das hordas de Filhos de Skandir. Argentan é o centro de poder e comércio da região; Galaris, uma de suas cidadelas mais cosmopolitas, é sua joia mais preciosa. Os Rhuranianos valorizam o conhecimento e são devotos de Osterion, o sentinela.',
  },
  {
    d66: '35-36',
    name: 'Terras de Nimir',
    habilidades: ['Cura', 'Liderança', 'Luta', 'Ofício', 'Religião'],
    lore:
      'Terras férteis que acolhem diversas comunidades pacíficas devotas de Zirzan, entidade celestial benevolente venerada em amplos templos erigidos num passado distante.',
  },
  {
    d66: '41-42',
    name: 'Estepes de Kulgur',
    habilidades: ['Arremesso', 'Luta', 'Montaria', 'Pontaria', 'Rastreio'],
    lore:
      'Os Kulguranos cavalgam corcéis selvagens por este vasto território, enfrentando os terríveis Homens das Colinas. Fazem escalpos que amarram nas rédeas de suas montarias — um povo forjado pela estepe e pela guerra constante.',
  },
  {
    d66: '43-44',
    name: 'Cidadela de Tashar',
    habilidades: ['Feitiçaria', 'Luta', 'Manha', 'Ocultismo', 'Persuasão'],
    lore:
      'Já foi uma das cidades mais conhecidas da Costa da Serpente, até ser incendiada pelos Filhos de Skandir. Hoje é ocupada pelo bruxo Tzu Lao e seus seguidores, que exercem sua influência sombria sobre o que restou.',
  },
  {
    d66: '45-46',
    name: 'Cidadela de Galaris',
    habilidades: ['Erudição', 'Idioma', 'Luta', 'Negociação', 'Ofício'],
    lore:
      'Uma das cidadelas mais cosmopolitas do Reino de Rhuran, considerada sua joia mais preciosa — centro de comércio, conhecimento e diplomacia relativamente protegido das hordas do norte.',
  },
  {
    d66: '51-52',
    name: 'Cidadela de Nuvar',
    habilidades: ['Ataque Duplo', 'Combate', 'Intimidação', 'Luta', 'Religião'],
    lore: UNDISCOVERED,
  },
  {
    d66: '53-54',
    name: 'Colinas de Fergen',
    habilidades: ['Arremesso', 'Furtividade', 'Ladinagem', 'Luta', 'Pontaria'],
    lore: 'As colinas ermas de Fergen, no Reino de Rhuran, são apinhadas de salteadores que emboscam viajantes incautos.',
  },
  {
    d66: '55-56',
    name: 'Cidadela de Udhum',
    habilidades: ['Feitiçaria', 'Luta', 'Ocultismo', 'Persuasão', 'Religião'],
    lore: UNDISCOVERED,
  },
  {
    d66: '61-62',
    name: 'Terras de Voskur',
    habilidades: ['Arremesso', 'Caça', 'Exploração', 'Luta', 'Resistência'],
    lore:
      'Um território congelado e inóspito no limiar setentrional de Horkia, que abriga os gigantes Voskur — antigos aliados dos povos do norte que se juntaram aos Filhos de Skandir na invasão das terras livres.',
  },
  {
    d66: '63-64',
    name: 'Norte Gélido',
    habilidades: ['Caça', 'Luta', 'Navegação', 'Resistência', 'Sobrevivência'],
    lore:
      'Terra dos Horkianos, temidos por seus barcos leves usados em pilhagens rio acima. Voskur, um território congelado e inóspito que abriga os povos gigantes, fica no limiar setentrional destas terras. Janya, Boldor e Saerog formam o panteão de Horkia.',
  },
  {
    d66: '65-66',
    name: 'Sul Escaldante',
    habilidades: ['Feitiçaria', 'Luta', 'Persuasão', 'Pontaria', 'Religião'],
    lore:
      'Lar do povo de Ossiria, severamente castigado pela corrupção de seus cruéis vizires — os impiedosos seguidores de Oloch. Além dos desertos escaldantes estão as savanas selvagens do povo Tumbu e, no extremo sul, os Darsan, de espiritualidade elevada porém corrompida por criaturas sombrias.',
  },
]
