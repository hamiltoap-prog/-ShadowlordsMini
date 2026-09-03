import { useState } from 'react'
import { normalizeImageUrl } from '../lib/imageUrl'
import { Portrait } from './Portrait'
import { Button, Input } from './ui'

/** Avatar com um botão de lápis por cima — clique para trocar a foto por URL, a qualquer momento. */
export function PortraitEditor({
  url,
  name,
  size = 64,
  onSave,
}: {
  url?: string
  name: string
  size?: number
  onSave: (url: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url ?? '')

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Portrait url={draft} name={name} size={size} />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setDraft((d) => normalizeImageUrl(d))}
            placeholder="URL da foto (aceita link do Google Drive)"
            className="w-48"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="primary"
            onClick={() => {
              onSave(normalizeImageUrl(draft))
              setEditing(false)
            }}
          >
            Salvar
          </Button>
          <Button
            onClick={() => {
              setDraft(url ?? '')
              setEditing(false)
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(url ?? '')
        setEditing(true)
      }}
      className="group relative shrink-0"
      title="Trocar foto"
    >
      <Portrait url={url} name={name} size={size} />
      <span
        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-purple-700/50 bg-[var(--surface-card)] text-xs opacity-80 transition group-hover:opacity-100"
        style={{ fontSize: Math.max(10, size * 0.18) }}
      >
        ✏️
      </span>
    </button>
  )
}
