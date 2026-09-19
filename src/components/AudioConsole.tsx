import { useEffect, useRef, useState } from 'react'
import { parseAudioUrl } from '../lib/audioUrl'
import { newId } from '../lib/id'
import { deleteAudioTrack, listenAudioTracks, saveAudioTrack } from '../lib/store'
import { AUDIO_KINDS, AUDIO_KIND_LABELS } from '../types'
import type { AudioKind, AudioTrack, GameTable } from '../types'
import { AudioChannel } from './TableAudio'
import type { AudioChannelHandle, AudioStatus } from './TableAudio'
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
  /** Faixa recém-adicionada: testada sozinha, para o Mestre não descobrir na sessão. */
  const [justAdded, setJustAdded] = useState<string | null>(null)

  // O aviso do link aparece enquanto se digita, não depois de salvar.
  const preview = parseAudioUrl(url)

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
    const id = newId()
    // Marcado antes de salvar: o Firestore avisa a lista na hora, e a linha
    // precisa já nascer sabendo que é a faixa recém-adicionada.
    setJustAdded(id)
    await saveAudioTrack(table.id, {
      id,
      tableId: table.id,
      kind,
      label: label.trim(),
      url: parsed.url,
      altUrls: parsed.altUrls,
      sourceUrl: url.trim(),
      source: parsed.source,
      provider: parsed.provider,
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
          placeholder="Link do YouTube ou do arquivo de áudio"
          className="min-w-[14rem] flex-1"
        />
        <Button variant="primary" onClick={add}>
          Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-purple-400/50">{HINTS[kind]}</p>

      {preview?.warning && (
        <p className="rounded border border-amber-700/50 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-200">
          ⚠ {preview.warning}
        </p>
      )}
      {preview && preview.provider !== 'other' && preview.provider !== 'drive' && (
        <p className="text-[11px] text-emerald-300/80">
          ✓ Link reconhecido ({preview.provider === 'youtube' ? 'YouTube' : preview.provider}) e convertido para o
          formato que toca.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-purple-400/50">
        <b className="text-purple-300/70">O que funciona:</b> links do <b>YouTube</b>, e qualquer endereço que devolva o
        arquivo direto — Dropbox, OneDrive e GitHub são convertidos sozinhos ao colar. <b>O Google Drive não serve</b>:
        ele não deixa outros sites tocarem o arquivo, mesmo público. Toda faixa tem um <b>▶ testar</b> logo abaixo — use
        antes da sessão.
      </p>
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
                <TrackRow
                  key={t.id}
                  track={t}
                  autoTest={t.id === justAdded}
                  onDelete={() => deleteAudioTrack(table.id, t.id)}
                />
              ))}
              {list.length === 0 && <p className="text-xs text-purple-400/40">Nada aqui ainda.</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Uma faixa da biblioteca, com um teste no lugar.
 *
 * Sem isso, um link quebrado só aparecia como silêncio no meio da sessão — que
 * foi exatamente o que aconteceu na primeira rodada de testes.
 */
function TrackRow({
  track,
  autoTest = false,
  onDelete,
}: {
  track: AudioTrack
  /** Faixa recém-adicionada: já entra testando. */
  autoTest?: boolean
  onDelete: () => void
}) {
  const [testing, setTesting] = useState(autoTest)
  const [status, setStatus] = useState<AudioStatus>({ state: 'idle' })
  const handle = useRef<AudioChannelHandle | null>(null)

  // A linha pode nascer antes do "acabei de adicionar" chegar — nesse caso o
  // teste começa aqui. Depois de parado à mão, não volta a ligar sozinho.
  const startedAuto = useRef(false)
  useEffect(() => {
    if (!autoTest || startedAuto.current) return
    startedAuto.current = true
    setTesting(true)
  }, [autoTest])

  return (
    <div
      data-audio-item={track.label}
      className="flex flex-col gap-1 rounded border border-purple-900/30 bg-black/20 px-2 py-1 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge>{track.source === 'youtube' ? 'YouTube' : 'arquivo'}</Badge>
          <span className="truncate text-purple-100">{track.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            className="text-purple-300 hover:text-[color:var(--gold-bright)]"
            title="Ouvir esta faixa agora, só na sua tela"
            onClick={() => {
              if (testing) {
                setTesting(false)
                setStatus({ state: 'idle' })
                return
              }
              // O play tem que sair de dentro do clique.
              handle.current?.unlock()
              setTesting(true)
            }}
          >
            {testing ? '■ parar' : '▶ testar'}
          </button>
          <button className="text-red-400 hover:text-red-200" onClick={onDelete}>
            ✕
          </button>
        </span>
      </div>

      {testing && (
        <p
          data-test-status={status.state}
          className={status.state === 'error' ? 'text-red-300' : 'text-purple-300/60'}
        >
          {status.state === 'playing' && '🔊 tocando — o link funciona.'}
          {status.state === 'loading' && 'carregando...'}
          {status.state === 'idle' && 'começando...'}
          {status.state === 'error' && `⚠ ${status.message}`}
        </p>
      )}

      <AudioChannel
        label={`test:${track.id}`}
        track={testing ? track : null}
        volume={0.5}
        enabled={testing}
        preloadYoutube={track.source === 'youtube'}
        onRegister={(_, h) => {
          handle.current = h
        }}
        onStatus={setStatus}
      />
    </div>
  )
}
