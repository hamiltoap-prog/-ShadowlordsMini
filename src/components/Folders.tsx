import { useState, type ReactNode } from 'react'
import {
  NO_FOLDER,
  buildTree,
  folderDestination,
  isInside,
  normalizePath,
  parentFolder,
  showPath,
  type FolderNode,
} from '../lib/folders'
import { Button, Input, Select } from './ui'

/**
 * A árvore de pastas e o seletor "mover para", usados pela biblioteca da tela
 * de jogo (cenas, ícones, histórias) e pela aba de NPCs.
 *
 * Pasta não é documento (ver `lib/folders.ts`): criar uma subpasta é mover um
 * item para um caminho novo — "Arco 1 > Masmorra" — e ela passa a existir.
 */

/** Quais pastas estavam fechadas, por navegador. Bloqueado (aba anônima,
 *  pré-visualização) não pode quebrar a tela: só não lembra. */
function readClosed(key: string | undefined): Record<string, boolean> {
  if (!key) return {}
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function saveClosed(key: string | undefined, v: Record<string, boolean>) {
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // Armazenamento bloqueado: a árvore só não lembra o que estava fechado.
  }
}

/** Pede o caminho de uma pasta nova, já começando pela pasta de agora. */
export function askNewFolder(current?: string): string | null {
  const suggestion = current ? `${showPath(current)} › ` : ''
  const answer = window.prompt('Nome da pasta. Para uma subpasta, separe com ">" — ex.: Arco 1 > Masmorra', suggestion)
  if (answer === null) return null
  return normalizePath(answer)
}

/**
 * "Mover para": todas as pastas pelo caminho INTEIRO — só o último nome
 * confundia quando havia duas "Masmorra" em arcos diferentes — mais "nova
 * pasta", que é como se cria uma subpasta.
 */
export function FolderSelect({
  value,
  folders,
  onChange,
  className = '',
  title = 'Mover para outra pasta',
}: {
  value: string | undefined
  folders: readonly string[]
  onChange: (path: string | undefined) => void
  className?: string
  title?: string
}) {
  const current = normalizePath(value)
  return (
    <Select
      value={current}
      className={`!w-auto max-w-[11rem] !px-1.5 !py-0.5 text-[11px] ${className}`}
      title={title}
      data-move-folder=""
      onChange={(e) => {
        const v = e.target.value
        if (v === '__new__') {
          const created = askNewFolder(current)
          if (created !== null) onChange(created || undefined)
          return
        }
        onChange(v || undefined)
      }}
    >
      <option value="">{NO_FOLDER}</option>
      {folders.map((p) => (
        <option key={p} value={p}>
          {showPath(p)}
        </option>
      ))}
      <option value="__new__">+ nova pasta...</option>
    </Select>
  )
}

export function FolderTree<T>({
  items,
  folderOf,
  label,
  itemKey,
  renderItem,
  onMoveFolder,
  folders,
  rememberKey,
  itemsClassName = 'flex flex-col gap-1',
}: {
  items: readonly T[]
  folderOf: (item: T) => string | undefined
  label: (item: T) => string
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Renomear e mover pasta são a mesma coisa: trocar o começo do caminho. */
  onMoveFolder: (from: string, to: string) => Promise<void> | void
  /** Todas as pastas (para o "mover pasta"). */
  folders: readonly string[]
  /** Chave no navegador para lembrar quais pastas estavam fechadas. */
  rememberKey?: string
  itemsClassName?: string
}) {
  const root = buildTree(items, folderOf, label)
  const [closed, setClosed] = useState<Record<string, boolean>>(() => readClosed(rememberKey))

  function toggle(path: string) {
    setClosed((c) => {
      const v = { ...c, [path]: !c[path] }
      saveClosed(rememberKey, v)
      return v
    })
  }

  return (
    <div className="flex flex-col gap-2" data-folder-tree="">
      {root.subfolders.map((f) => (
        <Folder
          key={f.path}
          node={f}
          level={0}
          closed={closed}
          toggle={toggle}
          renderItem={renderItem}
          itemKey={itemKey}
          onMoveFolder={onMoveFolder}
          folders={folders}
          itemsClassName={itemsClassName}
        />
      ))}
      {root.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {root.subfolders.length > 0 && (
            <p className="text-[10px] uppercase tracking-[0.14em] text-purple-400/50">
              {NO_FOLDER} ({root.items.length})
            </p>
          )}
          <div className={itemsClassName}>
            {/* `contents`: o grid da página continua valendo para os cartões. */}
            {root.items.map((i) => (
              <div key={itemKey(i)} className="contents">
                {renderItem(i)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Folder<T>({
  node,
  level,
  closed,
  toggle,
  renderItem,
  itemKey,
  onMoveFolder,
  folders,
  itemsClassName,
}: {
  node: FolderNode<T>
  level: number
  closed: Record<string, boolean>
  toggle: (path: string) => void
  renderItem: (item: T) => ReactNode
  itemKey: (item: T) => string
  onMoveFolder: (from: string, to: string) => Promise<void> | void
  folders: readonly string[]
  itemsClassName: string
}) {
  const open = !closed[node.path]
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(node.name)
  const [moving, setMoving] = useState(false)
  // Destinos possíveis: qualquer pasta que não seja ela mesma, nem uma de
  // dentro dela (sumiria com a árvore), nem a de cima (já está lá).
  const destinations = folders.filter((p) => !isInside(p, node.path) && p !== parentFolder(node.path))

  return (
    <div
      className={`flex flex-col gap-1.5 ${level > 0 ? 'border-l border-[color:var(--gold-dark)] pl-3' : ''}`}
      data-folder={node.path}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-purple-900/40 pb-1">
        <button
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[color:var(--gold)] hover:text-[color:var(--gold-bright)]"
          onClick={() => toggle(node.path)}
        >
          {open ? '▾' : '▸'} 📁 {node.name} <span className="text-purple-400/60">({node.total})</span>
        </button>
        {renaming ? (
          <span className="flex items-center gap-1">
            <Input value={name} style={{ width: '9rem' }} className="!px-2 !py-0.5 text-[11px]" onChange={(e) => setName(e.target.value)} />
            <Button
              variant="primary"
              className="px-2 py-0.5 text-[10px]"
              onClick={async () => {
                // O nome é um pedaço só: separador digitado aqui vira espaço.
                const clean = normalizePath(name).replace(/\//g, ' ')
                if (clean && clean !== node.name) {
                  await onMoveFolder(node.path, [parentFolder(node.path), clean].filter(Boolean).join('/'))
                }
                setRenaming(false)
              }}
            >
              ok
            </Button>
            <Button variant="ghost" className="px-2 py-0.5 text-[10px]" onClick={() => setRenaming(false)}>
              x
            </Button>
          </span>
        ) : moving ? (
          <span className="flex items-center gap-1">
            <Select
              defaultValue="__"
              className="!w-auto !px-1.5 !py-0.5 text-[11px]"
              onChange={async (e) => {
                const v = e.target.value
                if (v === '__') return
                await onMoveFolder(node.path, folderDestination(node.path, v === '__root__' ? '' : v))
                setMoving(false)
              }}
            >
              <option value="__">mover para dentro de...</option>
              {parentFolder(node.path) && <option value="__root__">(primeiro nível)</option>}
              {destinations.map((p) => (
                <option key={p} value={p}>
                  {showPath(p)}
                </option>
              ))}
            </Select>
            <Button variant="ghost" className="px-2 py-0.5 text-[10px]" onClick={() => setMoving(false)}>
              x
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <button
              className="text-[10px] text-purple-400/60 hover:text-[color:var(--gold)]"
              onClick={() => {
                setName(node.name)
                setRenaming(true)
              }}
            >
              renomear
            </button>
            <button className="text-[10px] text-purple-400/60 hover:text-[color:var(--gold)]" onClick={() => setMoving(true)}>
              mover pasta
            </button>
          </span>
        )}
      </div>
      {open && (
        <>
          {node.subfolders.map((s) => (
            <Folder
              key={s.path}
              node={s}
              level={level + 1}
              closed={closed}
              toggle={toggle}
              renderItem={renderItem}
              itemKey={itemKey}
              onMoveFolder={onMoveFolder}
              folders={folders}
              itemsClassName={itemsClassName}
            />
          ))}
          {node.items.length > 0 && (
            <div className={itemsClassName}>
              {node.items.map((i) => (
                <div key={itemKey(i)} className="contents">
                  {renderItem(i)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
