// Nome — Manual de Regras, pág. 45 (role 1d66)
export const NAMES: string[] = [
  'Abbados', 'Ahmad', 'Akesha', 'Anush', 'Arkhan', 'Azor',
  'Barak', 'Belemor', 'Belmur', 'Bhur', 'Bjornir', 'Burza',
  'Chung', 'Cindar', 'Cingal', 'Darah', 'Dashan', 'Drunna',
  'Elfar', 'Farid', 'Gargaros', 'Ghor', 'Grun', 'Gunna',
  'Hagla', 'Helga', 'Jannur', 'Kheng', 'Khuffa', 'Lokkar',
  'Mazzur', 'Mordum', 'Nazrah', 'Ostar', 'Sadda', 'Zakkor',
]

export function nameByIndex36(index36: number): string {
  return NAMES[Math.min(Math.max(index36, 0), NAMES.length - 1)]
}
