/**
 * Pastas e subpastas.
 *
 * Pasta aqui **não é documento**: é um caminho repetido nos itens — o campo
 * `folder` guarda `"Arco 1/Masmorra"`, e é isso que põe a "Sala do Trono"
 * dentro de Masmorra, dentro de Arco 1. A árvore é montada na hora, a partir
 * dos itens. Daí vêm, sem nada a administrar:
 *
 *  - pasta vazia some sozinha (não sobra pasta fantasma para limpar);
 *  - renomear ou mover uma pasta é trocar o começo do caminho em todos os
 *    itens dela — subpastas incluídas;
 *  - o mesmo código serve para cenas, ícones, histórias e NPCs: qualquer coisa
 *    com um `folder`.
 *
 * Itens gravados antes das subpastas têm um nome só (`"Masmorras"`) — que é
 * exatamente um caminho de um nível. Nada a migrar.
 */

/** O separador gravado. Na tela aparece como "›". */
export const FOLDER_SEP = '/'

/** O rótulo dos itens soltos, fora de qualquer pasta. Não é gravado. */
export const NO_FOLDER = 'Sem pasta'

/**
 * Caminho limpo: aceita o que a pessoa digita — "Arco 1 > Masmorra",
 * "Arco 1 / Masmorra", "Arco 1 › Masmorra" — e devolve "Arco 1/Masmorra".
 * Pedaço vazio sai; espaço em volta (e repetido dentro) de cada pedaço sai —
 * senão "Masmorra" e " Masmorra " viravam duas pastas gêmeas.
 */
export function normalizePath(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw
    .split(/\s*[/>›\\]\s*/)
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(FOLDER_SEP)
}

export function pathParts(path: string | undefined): string[] {
  const c = normalizePath(path)
  return c ? c.split(FOLDER_SEP) : []
}

/** "Arco 1/Masmorra" → "Arco 1 › Masmorra"; vazio → "Sem pasta". */
export function showPath(path: string | undefined): string {
  const parts = pathParts(path)
  return parts.length ? parts.join(' › ') : NO_FOLDER
}

/** O último nome do caminho: "Arco 1/Masmorra" → "Masmorra". */
export function folderName(path: string): string {
  const parts = pathParts(path)
  return parts[parts.length - 1] ?? ''
}

/** A pasta de cima: "Arco 1/Masmorra" → "Arco 1"; de primeiro nível → "". */
export function parentFolder(path: string): string {
  return pathParts(path).slice(0, -1).join(FOLDER_SEP)
}

/**
 * O item está nesta pasta ou em alguma subpasta dela? Compara por pedaço, e
 * não por começo de texto: "Arco 10" NÃO está dentro de "Arco 1".
 */
export function isInside(itemPath: string | undefined, folder: string): boolean {
  const c = normalizePath(itemPath)
  const p = normalizePath(folder)
  if (!p) return true
  return c === p || c.startsWith(p + FOLDER_SEP)
}

/** Sem diferença de maiúscula e acento, e com número em ordem de número: "Cena 2" antes de "Cena 10". */
export const comparePt = (a: string, b: string) => a.localeCompare(b, 'pt', { sensitivity: 'base', numeric: true })

/** Todas as pastas que existem, com as de cima incluídas, em ordem de árvore. */
export function allFolders(paths: readonly (string | undefined)[]): string[] {
  const all = new Set<string>()
  for (const c of paths) {
    const parts = pathParts(c)
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join(FOLDER_SEP))
  }
  return [...all].sort((a, b) => {
    const pa = a.split(FOLDER_SEP)
    const pb = b.split(FOLDER_SEP)
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      const c = comparePt(pa[i], pb[i])
      if (c !== 0) return c
    }
    return pa.length - pb.length
  })
}

export interface FolderNode<T> {
  /** Caminho completo; "" na raiz. */
  path: string
  name: string
  subfolders: FolderNode<T>[]
  /** Itens diretamente nesta pasta. */
  items: T[]
  /** Itens aqui e em todas as subpastas. */
  total: number
}

/**
 * Monta a árvore. A raiz guarda os itens soltos e as pastas de primeiro
 * nível; cada lista sai em ordem (pastas por nome, itens por `label`).
 */
export function buildTree<T>(
  items: readonly T[],
  folderOf: (item: T) => string | undefined,
  label: (item: T) => string,
): FolderNode<T> {
  const root: FolderNode<T> = { path: '', name: '', subfolders: [], items: [], total: 0 }
  const byPath = new Map<string, FolderNode<T>>([['', root]])

  const node = (path: string): FolderNode<T> => {
    const existing = byPath.get(path)
    if (existing) return existing
    const parent = node(parentFolder(path))
    const created: FolderNode<T> = { path, name: folderName(path), subfolders: [], items: [], total: 0 }
    parent.subfolders.push(created)
    byPath.set(path, created)
    return created
  }

  for (const item of items) {
    const path = normalizePath(folderOf(item))
    node(path).items.push(item)
    // O item conta em todas as pastas do caminho: "Arco 1 (3)" com 1 item
    // direto e 2 numa subpasta.
    const parts = pathParts(path)
    root.total++
    for (let i = 1; i <= parts.length; i++) byPath.get(parts.slice(0, i).join(FOLDER_SEP))!.total++
  }

  const sort = (n: FolderNode<T>) => {
    n.subfolders.sort((a, b) => comparePt(a.name, b.name))
    n.items.sort((a, b) => comparePt(label(a), label(b)))
    n.subfolders.forEach(sort)
  }
  sort(root)
  return root
}

/**
 * O caminho do item depois de a pasta `from` virar `to` — renomear e mover são
 * a mesma operação. Devolve `null` quando o item não está na pasta (nada a
 * gravar).
 *
 * `to` vazio põe o conteúdo da pasta na raiz. Mover uma pasta para dentro dela
 * mesma é recusado (`null`): os itens iriam para um caminho que nunca aparece,
 * e a árvore sumiria.
 */
export function pathAfterMove(itemPath: string | undefined, from: string, to: string): string | null {
  const c = normalizePath(itemPath)
  const origin = normalizePath(from)
  const dest = normalizePath(to)
  if (!origin || !isInside(c, origin)) return null
  if (dest !== origin && isInside(dest, origin)) return null
  const rest = c.slice(origin.length).replace(/^\//, '')
  return [dest, rest].filter(Boolean).join(FOLDER_SEP)
}

/** "Mover a pasta Masmorra para dentro de Arco 2": o caminho novo dela. */
export function folderDestination(folder: string, newParent: string): string {
  return [normalizePath(newParent), folderName(folder)].filter(Boolean).join(FOLDER_SEP)
}

/** Para gravar: caminho vazio vira `undefined` (o campo sai do documento, em vez de ficar ""). */
export function folderToSave(path: string | undefined | null): string | undefined {
  return normalizePath(path) || undefined
}
