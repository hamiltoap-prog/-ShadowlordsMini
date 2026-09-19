import { useEffect, useState } from 'react'
import { parseAudioUrl } from '../lib/audioUrl'
import { newId } from '../lib/id'
import { deleteAudioTrack, listenAudioTracks, saveAudioTrack } from '../lib/store'
import { AUDIO_KINDS, AUDIO_KIND_LABELS } from '../types'
import type { AudioKind, AudioTrack, GameTable } from '../types'
import { Badge, Button, Card, Input, SectionTitle, Select } from './ui'

/**
 * Mesa de som do Mestre: onde as faixas são preparadas antes da sessão.
 *
 * Ambientação e Clima aceitam quantas faixas o Mestre quiser (ele escolhe na
 * hora, na tela de jogo). Combate e Combate de Chefe são uma só cada: entram
 * sozinhas quando a briga começa, então não faz sentido ter escolha ali.
 */

const HINTS: Record<AudioKind, string> = {
  ambience: 'Fundo em looping: floresta, chuva, taverna, vento.',
  mood: 'O clima da cena: tenso, solene, alegre. Toca junto com a ambientação.',
  combat: 'Entra sozinha quando o combate começa e devolve o som ao acabar.',
  boss: 'Mesma coisa, para as batalhas de chefe.',
}

const SINGLE: AudioKind[] = ['combat', 'boss']

export function AudioConsole({ table }: { table: GameTable }) {
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [kind, setKind] = useState<AudioKind>('ambience')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => listenAudioTracks(table.id, setTracks), [table.id])

  async function add() {
    const parsed = parseAudioUrl(url)
    if (!parsed || !label.trim()) {
      setError('Dê um nome à faixa e cole o link.')
      return
    }
    setError('')
    // Combate e chefe têm uma faixa só: a nova substitui a anterior.
    if (SINGLE.includes(kind)) {
      await Promise.all(tracks.filter((t) => t.kind === kind).map((t) => deleteAudioTrack(table.id, t.id)))
    }
    await saveAudioTrack(table.id, {
      id: newId(),
      tableId: table.id,
      kind,
      label: label.trim(),
      url: parsed.url,
      sourceUrl: url.trim(),
      source: parsed.source,
      youtubeId: parsed.youtubeId,
      createdAt: Date.now(),
    })
    setLabel('')
    setUrl('')
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <SectionTitle>🔊 Mesa de Som</SectionTitle>
      <p className="text-xs text-purple-300/50">
        Prepare aqui as faixas da campanha; na tela de jogo você escolhe o que toca. O som sai na tela de jogo de todo
        mundo — cada pessoa libera o áudio uma vez, por causa da regra de reprodução automática do navegador.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value as AudioKind)} className="w-auto">
          {AUDIO_KINDS.map((k) => (
            <option key={k} value={k}>
              {AUDIO_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da faixa" className="w-44" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link do YouTube ou do Google Drive"
          className="min-w-[14rem] flex-1"
        />
        <Button variant="primary" onClick={add}>
          Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-purple-400/50">{HINTS[kind]}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {AUDIO_KINDS.map((k) => {
          const list = tracks.filter((t) => t.kind === k)
          return (
            <div key={k} className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-[0.14em] text-purple-400/60">
                {AUDIO_KIND_LABELS[k]}
                {SINGLE.includes(k) && <span className="ml-1 text-purple-400/40">(uma faixa)</span>}
              </p>
              {list.map((t) => (
                <div
                  key={t.id}
                  data-audio-item={t.label}
                  className="flex items-center justify-between gap-2 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Badge>{t.source === 'youtube' ? 'YouTube' : 'arquivo'}</Badge>
                    <span className="truncate text-purple-100">{t.label}</span>
                  </span>
                  <button
                    className="shrink-0 text-red-400 hover:text-red-200"
                    onClick={() => deleteAudioTrack(table.id, t.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {list.length === 0 && <p className="text-xs text-purple-400/40">Nada aqui ainda.</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
