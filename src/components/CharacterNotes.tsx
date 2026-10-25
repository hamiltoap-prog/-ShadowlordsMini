import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { newId } from '../lib/id'
import {
  deleteCharacterNote,
  listenCharacterNotes,
  saveCharacterNote,
  updateCharacter,
  updateCharacterNote,
} from '../lib/store'
import type { Character, CharacterNote } from '../types'
import { Button, Input } from './ui'

/**
 * As notas do personagem: quantas o jogador quiser, cada uma com título e
 * texto formatado. Clicar numa nota abre para editar; o que se escreve é
 * salvo sozinho, logo depois de parar de digitar, e de novo ao fechar.
 *
 * As notas ficam fora da ficha (que a mesa toda lê): só o dono e o Mestre
 * enxergam. A anotação única de antes vira a primeira nota, sem perder nada.
 */

const AUTOSAVE_MS = 1000

// O editor de texto só é baixado quando uma nota é aberta: a ficha continua
// leve para quem só quer rolar dados no celular.
const RichTextEditor = lazy(() => import('./RichTextEditor').then((m) => ({ default: m.RichTextEditor })))

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** O campo de texto antigo vira HTML: cada linha um parágrafo. */
function legacyToHtml(text: string) {
  return text
    .split(/\n/)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('')
}

function when(ts: number) {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

const LEGACY_ID = 'anotacoes-antigas'

export function CharacterNotes({ tableId, character }: { tableId: string; character: Character }) {
  const [notes, setNotes] = useState<CharacterNote[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setNotes(null)
    setOpenId(null)
    return listenCharacterNotes(tableId, character.id, (n) => {
      if (n === null) setFailed(true)
      else setNotes(n)
    })
  }, [tableId, character.id])

  // A anotação antiga (um campo de texto na ficha) vira a primeira nota. O id
  // é fixo: se dois aparelhos fizerem isso ao mesmo tempo, sai uma nota só.
  const legacy = character.notes?.trim() ?? ''
  useEffect(() => {
    if (notes === null || !legacy) return
    const now = Date.now()
    void (async () => {
      if (!notes.some((n) => n.id === LEGACY_ID)) {
        await saveCharacterNote(tableId, character.id, {
          id: LEGACY_ID,
          title: 'Anotações',
          html: legacyToHtml(legacy),
          text: legacy,
          createdAt: now,
          updatedAt: now,
        })
      }
      await updateCharacter(tableId, character.id, { notes: '' })
    })()
  }, [notes, legacy, tableId, character.id])

  async function create() {
    const now = Date.now()
    const note: CharacterNote = { id: newId(), title: '', html: '', text: '', createdAt: now, updatedAt: now }
    await saveCharacterNote(tableId, character.id, note)
    setOpenId(note.id)
  }

  if (failed) return <p className="text-sm text-red-300">Não foi possível carregar as notas.</p>
  if (notes === null) return <p className="text-sm text-purple-300/50">Carregando notas...</p>

  const open = notes.find((n) => n.id === openId)
  if (open) {
    return (
      <NoteEditor
        key={open.id}
        note={open}
        onSave={(patch) => updateCharacterNote(tableId, character.id, open.id, patch)}
        onDelete={async () => {
          await deleteCharacterNote(tableId, character.id, open.id)
          setOpenId(null)
        }}
        onClose={() => setOpenId(null)}
      />
    )
  }

  const q = search.trim().toLowerCase()
  const shown = notes
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt)

  return (
    <div className="flex flex-col gap-2" data-notes-list="">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={create} data-new-note="">
          + nova nota
        </Button>
        {notes.length > 3 && (
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 buscar nas notas"
            style={{ width: '14rem', maxWidth: '100%' }}
            className="!py-1 text-xs"
            data-notes-search=""
          />
        )}
        <span className="text-[11px] text-purple-400/50">só você e o Mestre veem suas notas</span>
      </div>
      {notes.length === 0 && (
        <p className="text-sm text-purple-300/50">Nenhuma nota ainda. Segredos, objetivos, contatos, pistas — crie uma para cada assunto.</p>
      )}
      {notes.length > 0 && shown.length === 0 && <p className="text-sm text-purple-300/50">Nenhuma nota com “{search}”.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((n) => (
          <button
            key={n.id}
            onClick={() => setOpenId(n.id)}
            className="flex min-w-0 flex-col gap-1 border border-[color:var(--gold-dark)] bg-black/20 p-2.5 text-left transition hover:border-[color:var(--gold)] hover:bg-black/30"
            data-note={n.title || 'Sem título'}
          >
            <span className="flex items-center gap-1.5">
              {n.pinned && <span title="Fixada">📌</span>}
              <span className={`truncate font-semibold ${n.title ? 'text-purple-50' : 'italic text-purple-300/60'}`}>{n.title || 'Sem título'}</span>
            </span>
            <span className="line-clamp-2 whitespace-pre-line text-xs text-purple-300/70">{n.text || 'Nota vazia'}</span>
            <span className="text-[10px] text-purple-400/50">{when(n.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

function NoteEditor({
  note,
  onSave,
  onDelete,
  onClose,
}: {
  note: CharacterNote
  onSave: (patch: Partial<CharacterNote>) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(note.title)
  const [state, setState] = useState<SaveState>('saved')
  // O que ainda não foi para o banco. Fica num ref para o "fechar" e o
  // desmontar salvarem a última versão, mesmo antes do tempo do salvamento.
  const pending = useRef<Partial<CharacterNote> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  })
  const latestText = useRef(note.text)

  async function flush() {
    window.clearTimeout(timer.current)
    const patch = pending.current
    if (!patch) return
    pending.current = null
    setState('saving')
    try {
      await onSaveRef.current(patch)
      setState(pending.current ? 'pending' : 'saved')
    } catch {
      // Devolve o que falhou para a próxima tentativa.
      pending.current = { ...patch, ...(pending.current as Partial<CharacterNote> | null) }
      setState('error')
    }
  }

  function queue(patch: Partial<CharacterNote>) {
    pending.current = { ...pending.current, ...patch }
    setState('pending')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS)
  }

  // Saiu da nota de qualquer jeito (trocou de aba, fechou a ficha): salva.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (pending.current) void onSaveRef.current(pending.current)
    },
    [],
  )

  // Ctrl+S salva na hora.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function close() {
    await flush()
    // Nota criada e largada em branco não fica ocupando a lista.
    if (!title.trim() && !latestText.current.trim()) {
      await onDelete()
      return
    }
    onClose()
  }

  const status = { saved: 'salvo ✓', pending: 'editando...', saving: 'salvando...', error: 'não salvou — tente de novo' }[state]

  return (
    <div className="flex flex-col gap-2" data-note-editor="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="text-xs text-[color:var(--gold)] hover:text-[color:var(--gold-bright)]" onClick={() => void close()} data-note-back="">
          ← todas as notas
        </button>
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] ${state === 'error' ? 'text-red-300' : 'text-purple-400/60'}`} data-note-status={state}>
            {status}
          </span>
          <button
            className="text-xs text-purple-300 hover:text-[color:var(--gold)]"
            onClick={() => {
              void onSaveRef.current({ pinned: !note.pinned })
            }}
            title="Notas fixadas ficam no topo da lista"
          >
            {note.pinned ? '📌 desafixar' : '📌 fixar'}
          </button>
          <button
            className="text-xs text-red-400 hover:text-red-200"
            onClick={() => {
              if (window.confirm(`Apagar a nota "${title || 'Sem título'}"?`)) {
                pending.current = null
                void onDelete()
              }
            }}
            data-note-delete=""
          >
            apagar
          </button>
        </span>
      </div>
      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          queue({ title: e.target.value })
        }}
        placeholder="Título da nota"
        className="!text-base font-semibold"
        autoFocus={!note.title}
        data-note-title=""
      />
      <Suspense fallback={<p className="min-h-[14rem] border border-[color:var(--gold-dark)] p-3 text-sm text-purple-300/50">Abrindo o editor...</p>}>
        <RichTextEditor
          value={note.html}
          onChange={(html, text) => {
            latestText.current = text
            queue({ html, text })
          }}
          placeholder="Escreva aqui. Use a barra para negrito, títulos, listas e tarefas."
        />
      </Suspense>
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => void close()} disabled={state === 'saving'} data-note-save="">
          Salvar e fechar
        </Button>
      </div>
    </div>
  )
}
