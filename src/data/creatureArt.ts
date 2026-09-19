/**
 * Arte oficial das criaturas do Bestiário.
 *
 * Diferente da "imagem lembrada" por nome (que o Mestre escolhe e vale só para
 * a mesa dele), isto é a ilustração que vem com o jogo: igual para todo mundo,
 * e por isso mesmo não editável. Quem é do Bestiário usa esta; qualquer
 * criatura de fora continua com a foto que o Mestre quiser.
 *
 * As ilustrações moram numa pasta pública do Google Drive. Para imagem o Drive
 * serve normalmente (o que ele não faz é servir áudio), pelo endereço
 * `lh3.googleusercontent.com/d/<id>` — o mesmo que já convertemos quando
 * alguém cola um link do Drive num campo de foto.
 *
 * A chave é o nome da criatura normalizado (minúsculas, sem acento), então o
 * arquivo "Aberração Aracnoide.png" casa com a entrada do Bestiário sem
 * depender de acento nem de maiúscula. Onde o nome do arquivo saiu diferente
 * do nome no manual, o comentário ao lado registra qual arquivo é.
 */

import { BESTIARY } from './bestiary'

/** Minúsculas, sem acento, sem pontuação e com um espaço só entre palavras. */
export function creatureKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Nome normalizado da criatura → id do arquivo no Drive. */
const ART_FILE_IDS: Record<string, string> = {
  'aberracao aracnoide': '14a9lpW57znf8tv3jS_BALtR9jJ2Jo5eD',
  'abutre gigante': '1Gk-ZPWKaNYyyuY_ePlGiEZLrH-4j-4b7',  // Abutre.png
  'aranha gigante': '1Pc8VntwQiKoAPdZun-FWXaS6Eqg0O4ki',
  'cao selvagem': '1_Z4OqJGH1PXw1sLnyYdxAJjctuQGuUQS',
  'dorode': '1acnoO5__D0sFA2qlfqdMxcgl7bpUD4gU',
  'lobo': '1SxBOJFc8k0phkp2XzWjVX7gG0ntqiQ93',
  'morcego gigante': '1SGnzvmtaKezuXGBClxQednsBYPvCZiq0',
  'opaque': '1fKc0Np9Uh3d9zIyXx-NOKBgeIZtkc92L',
  'serpente gigante': '1xImaKL6yC1Qd1WRy7nEoVpuaUY3jmKyd',
  'urso': '19snkCtf7rj-1BhzJviB_n6OxyB-SmHr5',
  'aroque': '11I5Rqpv0Bn2hKyWdkL-Ue7KnmplV1Ppn',
  'chossora': '1_eeSHpkgrTouqd1ly4y3U3acieRh4owI',
  'galgur': '1UrQut17Nx7008VCyCk-SyS7upVvBlYhX',
  'nebelor': '1vjZRK6u0K8QykBs5SudTOBbClPSyPp3U',
  'vortrax': '1_lG5bdg4gv0i1F6qIy4lzq1ztOIFg-pA',
  'demonio de cinzas': '1Gd1ydVW3MaxmVZ0SkYrCEEyZLQ3aF-EB',
  'espirito demoniaco': '11wD6c4s8l6M21bG41AVR6HwIm646Yez-',
  'fera ciclopica': '1rmKrv_n5shnELiQN_olgtqp9DJ0Yao10',
  'grime': '1BjGorGRR0jXlBmndj3iE7MKiaqCYTR7-',
  'vordaque': '1_RsZ0QTNz5bk5fWtq4eR0kwincq2tzS1',
  'varogue': '1yMp0WKDHS4wxfx-2BIZrjO6ShMPc9nFw',
  'voskur': '1sBmp7NqsD6Ljna2t8gnge0bA9LMJbbFD',
  'criatura simiesca': '11cTPGpPAthu-2pMIoOu2IZnpkK54T2fd',
  'povo abutre': '1UzKUoqWMb4WQCbHILBMpqre2au1UTMbN',
  'povo cinzento': '10HmLMRfqgVMHx0riJvAWl4ILBhDUWRE7',
  'reptiliano': '1zcX8lBwJHe5NCt7_hG_389aRCO0Q3UCw',  // Repitiliano.png
  'arthax': '1nYrtplT4lcqlRXUou3EsOtWEqIg5uCjv',
  'druggur': '1Dq5cRnxZ8ONwbvyD2s0MMGwAiu9IaytQ',
  'gelruth': '1bfKejUhWIxg42og_vrdPCccvp3q2xvjF',
  'zozar': '1A1J8EVGyWBvYvQHiWHbaO6mQwEHeVwIH',
  'cadaver decrepito': '1BdSxUl_Ii35LsQjI02W1UnZaMEydHs1x',  // Cadáver Decrépto.png
  'cadaver congelado': '1K-jV5bK57303cUMVTezGhOg3GqSpof6t',
  'corpo seco': '1qO6Z1aqAFTCCps29JpoIRvaCirS0lnKE',
  'cranio sentinela': '1kqW7_Ei4qJmeQ8GhUZVhN4Qmf6QpXn8b',
  'espirito maligno': '1Ks1pmxKaVQfzHyeS_gQCPfpq2uKYxvGF',
  'esqueleto guerreiro': '1spMyFjMYPJ9EFdBIR8lk6mP3GebWBoLF',
  'sombra dominadora': '1OdKwLanC1n5yaxjDx6NMAPF9mihYcDPW',
  'vulto de areia': '14NMlbAKHVxquw5PVTbc_k9SRXN1dn5Cd',
  'quinute zelador': '1zcQGA0dfazoP2kAAm6-dj4w8k3DCJnid',
  'quinute guerreiro': '1Qiiw04J8uCrkw_WPrJ-LzZCPvJjpSAHV',
  'verme branco': '1mVnfpNq8lKfsBg3dMiWIxg9pXeKjW8Jf',
}

/**
 * Largura pedida ao Drive, em pixels.
 *
 * Os arquivos originais têm uns 2 MB cada; pedir os 41 em tamanho cheio para
 * preencher miniaturas de 44px seria dezenas de megabytes por página. O Drive
 * redimensiona no servidor quando a largura vai no fim do endereço.
 */
export const ART_THUMB_WIDTH = 160
export const ART_FULL_WIDTH = 640

/** A ilustração oficial desta criatura, se ela for do Bestiário. */
export function creatureArtUrl(name: string | undefined, width = ART_FULL_WIDTH): string | undefined {
  if (!name) return undefined
  const id = ART_FILE_IDS[creatureKey(name)]
  return id ? `https://lh3.googleusercontent.com/d/${id}=w${width}` : undefined
}

/** A foto que vale para uma criatura: a oficial manda, a do Mestre completa. */
export function resolveCreaturePortrait(
  name: string | undefined,
  portraitUrl?: string,
  width = ART_FULL_WIDTH,
): string | undefined {
  return creatureArtUrl(name, width) ?? portraitUrl
}

/** Esta criatura tem arte oficial — não faz sentido deixar trocar. */
export function hasOfficialArt(name: string | undefined): boolean {
  return name !== undefined && ART_FILE_IDS[creatureKey(name)] !== undefined
}

/** Criaturas do Bestiário ainda sem ilustração — usado nos testes. */
export function creaturesMissingArt(): string[] {
  return BESTIARY.filter((b) => !hasOfficialArt(b.name)).map((b) => b.name)
}
