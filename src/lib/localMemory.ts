// Pequenas lembranças locais do navegador: última mesa acessada, apelido usado, etc.
// Isso não é autenticação de verdade — a mesa é protegida apenas pelo código
// compartilhado com o grupo, um modelo adequado para jogar com amigos.

interface RecentTable {
  tableId: string
  tableName: string
  nickname: string
  isGM: boolean
  visitedAt: number
}

const KEY = 'shadowlords:recentTables'

export function getRecentTables(): RecentTable[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentTable[]
    return parsed.sort((a, b) => b.visitedAt - a.visitedAt)
  } catch {
    return []
  }
}

export function rememberTable(entry: Omit<RecentTable, 'visitedAt'>) {
  try {
    const list = getRecentTables().filter((t) => t.tableId !== entry.tableId)
    list.unshift({ ...entry, visitedAt: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)))
  } catch {
    // localStorage indisponível (modo privado, etc.) — apenas ignore
  }
}

export function forgetTable(tableId: string) {
  try {
    const list = getRecentTables().filter((t) => t.tableId !== tableId)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function getNickname(tableId: string): string | null {
  try {
    return localStorage.getItem(`shadowlords:nick:${tableId}`)
  } catch {
    return null
  }
}

export function setNickname(tableId: string, nickname: string) {
  try {
    localStorage.setItem(`shadowlords:nick:${tableId}`, nickname)
  } catch {
    // ignore
  }
}
