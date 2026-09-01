// Motor de dados — Shadowlords Mini System usa apenas d6, em diversas combinações.

export interface DiceResult {
  notation: string
  rolls: number[]
  modifier: number
  multiplier: number
  total: number
}

export function rollDie(sides = 6): number {
  return 1 + Math.floor(Math.random() * sides)
}

export function rollN(n: number, sides = 6): number[] {
  return Array.from({ length: Math.max(0, n) }, () => rollDie(sides))
}

/** Interpreta notações como "3d6", "1d6+6", "2d6x10", "1d3+3". */
export function roll(notation: string): DiceResult {
  const clean = notation.trim().toLowerCase().replace(/\s+/g, '')
  const match = clean.match(/^(\d+)d(\d+)(?:([+-]\d+))?(?:x(\d+))?$/)
  if (!match) {
    const flat = Number(clean)
    if (!Number.isNaN(flat)) {
      return { notation, rolls: [], modifier: flat, multiplier: 1, total: flat }
    }
    return { notation, rolls: [], modifier: 0, multiplier: 1, total: 0 }
  }
  const [, nStr, sidesStr, modStr, multStr] = match
  const n = Number(nStr)
  const sides = Number(sidesStr)
  const modifier = modStr ? Number(modStr) : 0
  const multiplier = multStr ? Number(multStr) : 1
  const rolls = rollN(n, sides)
  const sum = rolls.reduce((a, b) => a + b, 0)
  const total = (sum + modifier) * multiplier
  return { notation, rolls, modifier, multiplier, total }
}

export function roll3d6(): DiceResult {
  return roll('3d6')
}

export function roll1d6(): number {
  return rollDie(6)
}

export interface D66Result {
  tens: number
  units: number
  value: number // ex: 34
  index36: number // 0-35, ordem sequencial 11,12,...,16,21,...,66
}

export function roll1d66(): D66Result {
  const tens = rollDie(6)
  const units = rollDie(6)
  return { tens, units, value: tens * 10 + units, index36: (tens - 1) * 6 + (units - 1) }
}

export function d66ToIndex36(value: number): number {
  const tens = Math.floor(value / 10)
  const units = value % 10
  return (tens - 1) * 6 + (units - 1)
}

/** Localiza o índice de uma tabela expressa em pares "11-12", "13-14", ... para um valor 1d66. */
export function d66RangeIndex(value: number, ranges: string[]): number {
  const idx36 = d66ToIndex36(value)
  for (let i = 0; i < ranges.length; i++) {
    const [loStr, hiStr] = ranges[i].split('-')
    const lo = d66ToIndex36(Number(loStr))
    const hi = hiStr ? d66ToIndex36(Number(hiStr)) : lo
    if (idx36 >= lo && idx36 <= hi) return i
  }
  return Math.min(idx36, ranges.length - 1)
}

/** Calcula o Modificador de Atributo a partir do valor (pág. 21).
 * 3-12: 0 | 13-15: +1 | 16-18: +2 | acima disso, +1 a cada 3 pontos adicionais. */
export function attributeModFromScore(score: number): number {
  if (score <= 12) return 0
  return Math.floor((score - 10) / 3)
}

/** Rola um Atributo: 3d6, arredondando para 9 caso o resultado seja 8 ou menos. */
export function rollAttributeScore(): { score: number; mod: number; raw: DiceResult } {
  const raw = roll3d6()
  const score = raw.total <= 8 ? 9 : raw.total
  return { score, mod: attributeModFromScore(score), raw }
}
