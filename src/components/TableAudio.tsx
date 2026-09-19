import { useEffect, useRef, useState } from 'react'
import type { AudioTrack } from '../types'

/**
 * Um canal de som da mesa (ambientação, clima ou combate).
 *
 * Duas fontes possíveis, com a mesma interface para quem usa: um `<audio>` para
 * arquivo direto (inclusive Drive) e o player embutido do YouTube, que é o
 * único jeito de tocar um vídeo de lá. Toda troca passa por fade — entrar e
 * sair na unha estoura no ouvido de quem está jogando.
 *
 * Duas coisas aqui existem por causa do navegador, não do jogo:
 *
 * 1. Som só começa a partir de um gesto de quem está assistindo. Por isso o
 *    canal expõe `unlock()`, chamado *dentro* do clique em "Ligar o som" — e
 *    não num efeito depois, que em celular já não conta como gesto.
 * 2. O player do YouTube demora para ficar pronto. Enquanto não estiver, a
 *    faixa não é marcada como tocando, senão a tentativa seguinte seria
 *    ignorada e o canal ficaria mudo até alguém trocar de faixa — que era
 *    exatamente o "só funciona na segunda tentativa".
 */

const FADE_MS = 1200
const FADE_STEPS = 24
/** Um clique de silêncio: serve para "abençoar" o <audio> no gesto do usuário. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

export type AudioStatusState = 'idle' | 'loading' | 'playing' | 'error'
export interface AudioStatus {
  state: AudioStatusState
  message?: string
}

export interface AudioChannelHandle {
  /** Precisa ser chamado dentro do clique do usuário. */
  unlock: () => void
}

/** O script do YouTube é carregado uma vez só, por mais canais que existam. */
let youtubeApi: Promise<unknown> | null = null
function loadYoutubeApi(): Promise<unknown> {
  if (youtubeApi) return youtubeApi
  youtubeApi = new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>
    if ((w.YT as { Player?: unknown } | undefined)?.Player) {
      resolve(w.YT)
      return
    }
    const previous = w.onYouTubeIframeAPIReady as (() => void) | undefined
    w.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(w.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return youtubeApi
}

interface YoutubePlayer {
  loadVideoById: (id: string) => void
  playVideo: () => void
  pauseVideo: () => void
  setVolume: (v: number) => void
  unMute: () => void
  destroy: () => void
}

const YT_ERRORS: Record<number, string> = {
  2: 'Link do YouTube inválido.',
  5: 'Este vídeo não toca em player embutido.',
  100: 'Vídeo não encontrado ou privado.',
  101: 'O dono do vídeo não permite tocá-lo fora do YouTube.',
  150: 'O dono do vídeo não permite tocá-lo fora do YouTube.',
}

const MEDIA_ERRORS: Record<number, string> = {
  1: 'A reprodução foi interrompida.',
  2: 'Falha de rede ao buscar o arquivo — confira se o link é público.',
  3: 'O arquivo chegou, mas o navegador não conseguiu decodificá-lo.',
  4: 'O link não devolveu um áudio que o navegador saiba tocar (no Drive, isso quase sempre é arquivo não compartilhado como "qualquer pessoa com o link").',
}

export function AudioChannel({
  track,
  volume,
  enabled,
  label,
  /** Cria o player do YouTube já de saída, para ele estar pronto no clique. */
  preloadYoutube = false,
  onRegister,
  onStatus,
}: {
  track: AudioTrack | null
  /** 0 a 1. */
  volume: number
  /** O ouvinte já liberou o som nesta aba. */
  enabled: boolean
  label: string
  preloadYoutube?: boolean
  onRegister?: (label: string, handle: AudioChannelHandle | null) => void
  onStatus?: (status: AudioStatus) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const ytHost = useRef<HTMLDivElement>(null)
  const ytPlayer = useRef<YoutubePlayer | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentVolume = useRef(0)
  /** Faixa que está de fato tocando (só é preenchida quando o play aconteceu). */
  const playingId = useRef<string | null>(null)
  /** Qual endereço da faixa está sendo tentado (0 = o principal). */
  const urlIndex = useRef(0)
  const trackRef = useRef<AudioTrack | null>(track)
  const volumeRef = useRef(volume)
  const [ytReady, setYtReady] = useState(false)
  const [status, setStatus] = useState<AudioStatus>({ state: 'idle' })

  trackRef.current = track
  volumeRef.current = volume
  const targetId = enabled ? (track?.id ?? null) : null
  const needsYoutube = preloadYoutube || track?.source === 'youtube'

  useEffect(() => {
    onStatus?.(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state, status.message])

  function report(next: AudioStatus) {
    setStatus((prev) => (prev.state === next.state && prev.message === next.message ? prev : next))
  }

  function apply(v: number) {
    const clamped = Math.min(1, Math.max(0, v))
    currentVolume.current = clamped
    if (audioRef.current) audioRef.current.volume = clamped
    ytPlayer.current?.setVolume(Math.round(clamped * 100))
  }

  function fadeTo(target: number, done?: () => void) {
    if (fadeTimer.current) clearInterval(fadeTimer.current)
    const from = currentVolume.current
    const step = (target - from) / FADE_STEPS
    let i = 0
    fadeTimer.current = setInterval(() => {
      i += 1
      apply(i >= FADE_STEPS ? target : from + step * i)
      if (i >= FADE_STEPS) {
        if (fadeTimer.current) clearInterval(fadeTimer.current)
        fadeTimer.current = null
        done?.()
      }
    }, FADE_MS / FADE_STEPS)
  }

  /**
   * Coloca a faixa no ar. Só marca `playingId` quando o play realmente
   * aconteceu — é o que permite uma segunda tentativa quando o player do
   * YouTube ainda estava carregando.
   */
  function startTrack(fade: boolean) {
    const t = trackRef.current
    if (!t) return
    if (t.source === 'youtube') {
      if (!ytPlayer.current || !t.youtubeId) {
        report({ state: 'loading' })
        return
      }
      ytPlayer.current.loadVideoById(t.youtubeId)
      ytPlayer.current.unMute()
      ytPlayer.current.playVideo()
      playingId.current = t.id
    } else {
      const el = audioRef.current
      if (!el) return
      const candidates = [t.url, ...(t.altUrls ?? [])]
      const next = candidates[Math.min(urlIndex.current, candidates.length - 1)]
      if (el.src !== next) el.src = next
      playingId.current = t.id
      void el.play().catch((err: unknown) => {
        playingId.current = null
        // Bloqueio de autoplay é o único caso que o play() explica melhor que o
        // elemento. Falha de rede ou formato tem código próprio e a cadeia de
        // endereços de reserva para tentar — isso fica com o onError.
        if (err instanceof Error && err.name === 'NotAllowedError') {
          report({ state: 'error', message: 'O navegador bloqueou o som — clique em "Ligar o som".' })
        }
      })
    }
    apply(fade ? 0 : volumeRef.current)
    if (fade) fadeTo(volumeRef.current)
  }

  function stopTrack() {
    ytPlayer.current?.pauseVideo()
    audioRef.current?.pause()
    playingId.current = null
    report({ state: 'idle' })
  }

  // Cria o player do YouTube. Com `preloadYoutube`, isso acontece antes de
  // qualquer faixa ser escolhida — assim ele já está pronto no clique.
  useEffect(() => {
    if (!needsYoutube || ytPlayer.current || !ytHost.current) return
    let cancelled = false
    void loadYoutubeApi().then((api) => {
      if (cancelled || !ytHost.current) return
      const YT = api as { Player: new (el: HTMLElement, opts: unknown) => YoutubePlayer }
      ytPlayer.current = new YT.Player(ytHost.current, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: () => setYtReady(true),
          // O YouTube não tem loop de verdade para um vídeo só: quando acaba,
          // mandamos tocar de novo.
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) ytPlayer.current?.playVideo()
            if (e.data === 1) report({ state: 'playing' })
          },
          onError: (e: { data: number }) =>
            report({ state: 'error', message: YT_ERRORS[e.data] ?? 'O YouTube recusou este vídeo.' }),
        },
      })
    })
    return () => {
      cancelled = true
    }
  }, [needsYoutube])

  // Entradas e saídas: sai em fade, entra em fade. `ytReady` entra nas
  // dependências para o canal tentar de novo assim que o player ficar pronto.
  useEffect(() => {
    if (playingId.current === targetId) return

    if (!targetId) {
      if (playingId.current) fadeTo(0, stopTrack)
      return
    }
    urlIndex.current = 0
    if (playingId.current) {
      fadeTo(0, () => {
        stopTrack()
        startTrack(true)
      })
    } else {
      startTrack(true)
    }
    // `volume` fica de fora de propósito: mudá-lo não deve reiniciar a faixa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, ytReady])

  // Volume mexido com a mesma faixa no ar: acompanha na hora, sem fade.
  useEffect(() => {
    if (playingId.current) apply(volume)
  }, [volume])

  useEffect(() => {
    const handle: AudioChannelHandle = {
      unlock: () => {
        const el = audioRef.current
        // Um play() de silêncio dentro do gesto marca o elemento como liberado;
        // depois disso o navegador aceita tocar sem gesto novo.
        if (el) {
          if (!trackRef.current || trackRef.current.source === 'youtube') {
            const previous = el.src
            el.src = SILENT_WAV
            void el
              .play()
              .then(() => {
                el.pause()
                if (previous && previous !== SILENT_WAV) el.src = previous
              })
              .catch(() => {})
          }
        }
        if (trackRef.current) startTrack(true)
      },
    }
    onRegister?.(label, handle)
    return () => onRegister?.(label, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label])

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearInterval(fadeTimer.current)
      ytPlayer.current?.destroy()
    }
  }, [])

  return (
    <span
      data-audio-channel={label}
      data-audio-track={track?.id ?? ''}
      data-audio-state={status.state}
      data-audio-playing={enabled && track ? '1' : '0'}
    >
      <audio
        ref={audioRef}
        loop
        playsInline
        preload="auto"
        className="hidden"
        onPlaying={() => report({ state: 'playing' })}
        onWaiting={() => report({ state: 'loading' })}
        onError={() => {
          const code = audioRef.current?.error?.code ?? 4
          playingId.current = null
          // O Drive tem mais de um endereço de download para o mesmo arquivo;
          // antes de desistir, tentamos os outros.
          const candidates = [trackRef.current?.url, ...(trackRef.current?.altUrls ?? [])].filter(Boolean)
          if (trackRef.current && urlIndex.current < candidates.length - 1) {
            urlIndex.current += 1
            report({ state: 'loading' })
            startTrack(false)
            return
          }
          report({ state: 'error', message: MEDIA_ERRORS[code] ?? 'Não consegui tocar este link.' })
        }}
      />
      <span ref={ytHost} className="hidden" />
    </span>
  )
}
