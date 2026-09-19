/**
 * Arte oficial das criaturas do Bestiário.
 *
 * Diferente da "imagem lembrada" por nome (que o Mestre escolhe e vale só para
 * a mesa dele), isto é a ilustração que vem com o jogo: igual para todo mundo,
 * e por isso mesmo não editável. Quem é do Bestiário usa esta; qualquer
 * criatura de fora continua com a foto que o Mestre quiser.
 *
 * A chave é o nome da criatura normalizado (minúsculas, sem acento), para que o
 * arquivo "Aberracao Aracnoide.png" case com "Aberração Aracnoide" sem
 * depender de como o nome foi digitado.
 */

import { BESTIARY } from './bestiary'

/** Minúsculas, sem acento, sem pontuação e com um espaço só entre palavras. */
export function creatureKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Nome da criatura → endereço da ilustração.
 *
 * Preenchido a partir da pasta de artes do jogo: cada arquivo tem o nome da
 * criatura a que pertence.
 */
export const CREATURE_ART: Record<string, string> = {}

/** A ilustração oficial desta criatura, se ela for do Bestiário. */
export function creatureArtUrl(name: string | undefined): string | undefined {
  if (!name) return undefined
  return CREATURE_ART[creatureKey(name)]
}

/** A foto que vale para uma criatura: a oficial manda, a do Mestre completa. */
export function resolveCreaturePortrait(name: string | undefined, portraitUrl?: string): string | undefined {
  return creatureArtUrl(name) ?? portraitUrl
}

/** Esta criatura tem arte oficial — não faz sentido deixar trocar. */
export function hasOfficialArt(name: string | undefined): boolean {
  return creatureArtUrl(name) !== undefined
}

/** Criaturas do Bestiário ainda sem ilustração — usado nos testes. */
export function creaturesMissingArt(): string[] {
  return BESTIARY.filter((b) => !creatureArtUrl(b.name)).map((b) => b.name)
}
