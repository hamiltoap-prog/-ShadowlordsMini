// Bestiário — Manual de Regras, pág. 64-74
export interface BestiaryAttack {
  name: string
  dano: string
  note?: string
}

export interface BestiaryEntry {
  category: string
  name: string
  defense: number
  hp: number
  attacks: BestiaryAttack[]
  special?: string
}

export const BESTIARY: BestiaryEntry[] = [
  // Aberração Aracnoide
  { category: 'Aberração Aracnoide', name: 'Aberração Aracnoide', defense: 13, hp: 24, attacks: [
    { name: '2 Garras', dano: '1d6' }, { name: '1 Mordida', dano: '2d6' },
  ] },

  // Animais Selvagens
  { category: 'Animais Selvagens', name: 'Abutre Gigante', defense: 12, hp: 18, attacks: [{ name: '1 Bico', dano: '3d6' }] },
  { category: 'Animais Selvagens', name: 'Aranha Gigante', defense: 13, hp: 12, attacks: [{ name: '1 Mordida', dano: '2d6', note: '+ Veneno. Paralisia: 1-3 em 1d6' }] },
  { category: 'Animais Selvagens', name: 'Cão Selvagem', defense: 12, hp: 6, attacks: [{ name: '1 Mordida', dano: '1d6', note: '+ Doença. Morte em 2d6 dias' }] },
  { category: 'Animais Selvagens', name: 'Dorode', defense: 12, hp: 6, attacks: [{ name: '1 Chifre', dano: '1d6' }], special: 'Fere demônios e sombras como arma mágica. Pode curar ferimentos (1 chance em 1d6).' },
  { category: 'Animais Selvagens', name: 'Lagarto Gigante', defense: 14, hp: 48, attacks: [{ name: '1 Mordida', dano: '3d6' }] },
  { category: 'Animais Selvagens', name: 'Lobo', defense: 12, hp: 6, attacks: [{ name: '1 Mordida', dano: '2d6' }] },
  { category: 'Animais Selvagens', name: 'Morcego Gigante', defense: 13, hp: 9, attacks: [{ name: '1 Mordida', dano: '1d6', note: '+ Doença. Morte em 1d6 dias' }] },
  { category: 'Animais Selvagens', name: 'Opaque', defense: 12, hp: 6, attacks: [{ name: '1 Bico', dano: '1d6' }] },
  { category: 'Animais Selvagens', name: 'Serpente Gigante', defense: 13, hp: 24, attacks: [{ name: '1 Mordida', dano: '3d6', note: '+ Veneno. Morte em 1d6 horas' }] },
  { category: 'Animais Selvagens', name: 'Urso', defense: 12, hp: 18, attacks: [{ name: '1 Mordida', dano: '3d6' }] },

  // Bestas Demoníacas
  { category: 'Bestas Demoníacas', name: 'Aroque', defense: 13, hp: 24, attacks: [{ name: '2 Garras', dano: '2d6' }, { name: '1 Mordida', dano: '3d6' }] },
  { category: 'Bestas Demoníacas', name: 'Chossora', defense: 14, hp: 24, attacks: [{ name: '2 Pinças', dano: '2d6' }] },
  { category: 'Bestas Demoníacas', name: 'Galgur', defense: 15, hp: 48, attacks: [{ name: '1 Arma', dano: 'Dano +3' }], special: 'Armas comuns podem derreter em contato (1-3 em 1d6). Apenas atingido por armas mágicas ou feitiços.' },
  { category: 'Bestas Demoníacas', name: 'Nebelor', defense: 12, hp: 18, attacks: [{ name: '1 Arma ou Toque Agonizante', dano: 'Especial', note: '1d6: 1-3 pele chamuscada (1d6 PV), 4-5 pele escarificada (2d6 PV), 6 pele esfolada (3d6 PV)' }] },
  { category: 'Bestas Demoníacas', name: 'Vortrax', defense: 14, hp: 36, attacks: [{ name: '1 Mordida', dano: '2d6' }, { name: 'Baforada de Fogo', dano: '3d6' }], special: 'Hálito pode causar perda de consciência (1-2 em 1d6). Apenas atingida por armas mágicas ou feitiços.' },

  // Demônio de Cinzas
  { category: 'Demônio de Cinzas', name: 'Demônio de Cinzas', defense: 13, hp: 36, attacks: [{ name: 'Toque de Brasa', dano: '3d6' }], special: 'Apenas destruído por feitiços ou armas mágicas. Não é facilmente banido (1 chance em 1d6).' },
  { category: 'Demônio de Cinzas', name: 'Espírito Demoníaco', defense: 15, hp: 36, attacks: [{ name: 'Toque Calcinante', dano: '3d6' }] },

  // Fera Ciclópica
  { category: 'Fera Ciclópica', name: 'Fera Ciclópica', defense: 15, hp: 24, attacks: [{ name: '1 Mordida', dano: '2d6' }, { name: '2 Garras', dano: '1d6' }], special: 'Olhar pode paralisar por 1d6 minutos (1-2 em 1d6).' },

  // Filhos de Skandir
  { category: 'Filhos de Skandir', name: 'Grime', defense: 11, hp: 6, attacks: [{ name: '1 Arma', dano: '1d6' }], special: 'Usa dardos e flechas envenenadas à distância.' },
  { category: 'Filhos de Skandir', name: 'Vordaque', defense: 12, hp: 9, attacks: [{ name: '1 Arma', dano: '1d6', note: 'Dano +1' }] },
  { category: 'Filhos de Skandir', name: 'Varogue', defense: 13, hp: 24, attacks: [{ name: '1 Arma', dano: '1d6', note: 'Dano +2' }] },
  { category: 'Filhos de Skandir', name: 'Voskur', defense: 13, hp: 36, attacks: [{ name: '1 Arma', dano: '1d6', note: 'Dano +3' }] },

  // Humanoides
  { category: 'Humanoides', name: 'Criatura Simiesca', defense: 13, hp: 18, attacks: [{ name: '2 Garras', dano: '1d6' }, { name: '1 Mordida', dano: '2d6' }] },
  { category: 'Humanoides', name: 'Povo Abutre', defense: 12, hp: 12, attacks: [{ name: '1 Arma', dano: '1d6' }] },
  { category: 'Humanoides', name: 'Povo Cinzento', defense: 12, hp: 6, attacks: [{ name: '1 Arma', dano: '1d6' }], special: 'Muito inteligentes, praticam telepatia entre si.' },
  { category: 'Humanoides', name: 'Reptiliano', defense: 14, hp: 18, attacks: [{ name: '2 Garras', dano: '1d6' }], special: 'Não afetado por venenos ou toxinas comuns.' },

  // Lagartos Alados
  { category: 'Lagartos Alados', name: 'Arthax', defense: 15, hp: 54, attacks: [{ name: '2 Garras', dano: '1d6' }, { name: '1 Mordida', dano: '2d6' }, { name: '1 Chifre', dano: '3d6' }] },
  { category: 'Lagartos Alados', name: 'Druggur', defense: 15, hp: 60, attacks: [{ name: '1 Feitiço, 1 Mordida', dano: '2d6' }, { name: 'Baforada de Fogo', dano: '3d6' }] },
  { category: 'Lagartos Alados', name: 'Gelruth', defense: 15, hp: 72, attacks: [{ name: '2 Garras', dano: '2d6' }, { name: '1 Mordida', dano: '3d6' }] },
  { category: 'Lagartos Alados', name: 'Zozar', defense: 15, hp: 78, attacks: [{ name: '2 Garras', dano: '2d6' }, { name: '1 Mordida', dano: '3d6' }, { name: 'Baforada de Fogo', dano: '3d6' }] },

  // Mortos-Vivos
  { category: 'Mortos-Vivos', name: 'Cadáver Decrépito', defense: 11, hp: 4, attacks: [{ name: '1 Arma', dano: '1d6' }] },
  { category: 'Mortos-Vivos', name: 'Cadáver Congelado', defense: 12, hp: 6, attacks: [{ name: 'Toque Congelante', dano: '1d6', note: '+ Congelação. Paralisia: 1-3 em 1d6' }] },
  { category: 'Mortos-Vivos', name: 'Corpo Seco', defense: 12, hp: 12, attacks: [{ name: 'Toque Necrótico', dano: '1d6', note: '+ Doença. Morte em 2d6 dias' }] },
  { category: 'Mortos-Vivos', name: 'Crânio Sentinela', defense: 13, hp: 18, attacks: [{ name: 'Especial', dano: '0', note: 'Conjura feitiços e leviata. Olhar com gemas: efeitos variados por até 1d6 dias' }] },
  { category: 'Mortos-Vivos', name: 'Espírito Maligno', defense: 15, hp: 18, attacks: [{ name: 'Toque Mortal', dano: '0', note: '1d6: 1-3 perda de consciência (1d6 min), 4-5 perda de energia (1d6 PV), 6 morte' }], special: 'Apenas atingido por armas mágicas ou feitiços.' },
  { category: 'Mortos-Vivos', name: 'Esqueleto Guerreiro', defense: 13, hp: 18, attacks: [{ name: '1 Arma', dano: '1d6' }] },
  { category: 'Mortos-Vivos', name: 'Sombra Dominadora', defense: 15, hp: 24, attacks: [{ name: 'Toque Sombrio', dano: '2d6', note: '+ Especial. 1d6: 1-3 mente adormecida (1d6 min), 4-5 mente dominada (1d6h), 6 mente possuída (permanente)' }], special: 'Apenas atingida por armas mágicas ou feitiços.' },
  { category: 'Mortos-Vivos', name: 'Vulto de Areia', defense: 15, hp: 18, attacks: [{ name: 'Toque Arenoso', dano: '2d6' }], special: 'Apenas atingido por armas mágicas ou feitiços.' },

  // Povo Inseto
  { category: 'Povo Inseto', name: 'Quinute Zelador', defense: 12, hp: 6, attacks: [{ name: '1 Mordida', dano: '1d6' }] },
  { category: 'Povo Inseto', name: 'Quinute Guerreiro', defense: 14, hp: 12, attacks: [{ name: '1 Arma (Lâmina Quinute)', dano: '2d6' }] },

  // Verme Branco
  { category: 'Verme Branco', name: 'Verme Branco', defense: 12, hp: 24, attacks: [{ name: '1 Mordida', dano: '2d6' }, { name: '1 Esguicho', dano: '0', note: 'Pode cegar por 1d6 dias (1-2 em 1d6) ou engolir a vítima (1 em 1d6): 1 Dano/minuto' }] },
]

export const BESTIARY_CATEGORIES = Array.from(new Set(BESTIARY.map((b) => b.category)))
