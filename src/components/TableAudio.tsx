import { useEffect, useRef, useState } from 'react'
import type { AudioTrack } from '../types'

/**
 * Um canal de som da mesa (ambientação, clima ou combate).
 *
 * Duas fontes possíveis, com a mesma interface para quem usa: um `<audio>` para
 * arquivo direto (inclusive Drive) e o player embutido do YouTube, que é o
 * único jeito de tocar um vídeo de lá. Toda troca passa por fade — entrar e
 * sair na unha estoura no ouvido de quem está jogando.
 */

const FADE_MS = 1200
const FADE_STEPS = 24

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
  destroy: () => void
}

export function AudioChannel({
  track,
  volume,
  enabled,
  label,
}: {
  track: AudioTrack | null
  /** 0 a 1. */
  volume: number
  /** O ouvinte já liberou o som nesta aba (política de autoplay do navegador). */
  enabled: boolean
  label: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const ytHost = useRef<HTMLDivElement>(null)
  const ytPlayer = useRef<YoutubePlayer | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentVolume = useRef(0)
  const playingId = useRef<string | null>(null)
  const [ytReady, setYtReady] = useState(false)

  const targetId = enabled ? (track?.id ?? null) : null

  /** Aplica um volume 0..1 na fonte que estiver no ar. */
  function apply(v: number) {
    currentVolume.current = v
    if (audioRef.current) audioRef.current.volume = Math.min(1, Math.max(0, v))
    ytPlayer.current?.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100))
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

  // Cria o player do YouTube só quando alguma faixa do canal precisar dele.
  useEffect(() => {
    if (track?.source !== 'youtube' || ytPlayer.current || !ytHost.current) return
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
          },
        },
      })
    })
    return () => {
      cancelled = true
    }
  }, [track?.source])

  // Entradas e saídas: sai em fade, entra em fade.
  useEffect(() => {
    const desired = targetId
    if (playingId.current === desired) return

    const start = () => {
      if (!track || !desired) return
      playingId.current = desired
      apply(0)
      if (track.source === 'youtube') {
        if (!ytPlayer.current || !track.youtubeId) return
        ytPlayer.current.loadVideoById(track.youtubeId)
        ytPlayer.current.playVideo()
      } else if (audioRef.current) {
        audioRef.current.src = track.url
        void audioRef.current.play().catch(() => {
          /* autoplay bloqueado: o botão de liberar som resolve */
        })
      }
      fadeTo(volume)
    }

    if (playingId.current) {
      fadeTo(0, () => {
        ytPlayer.current?.pauseVideo()
        audioRef.current?.pause()
        playingId.current = null
        start()
      })
    } else {
      start()
    }
    // `volume` de propósito fora das dependências: mudar o volume no meio não
    // deve reiniciar a faixa — quem cuida disso é o efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, ytReady])

  // Volume mexido com a mesma faixa no ar: acompanha na hora, sem fade.
  useEffect(() => {
    if (playingId.current) apply(volume)
  }, [volume])

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearInterval(fadeTimer.current)
      ytPlayer.current?.destroy()
    }
  }, [])

  return (
    <span data-audio-channel={label} data-audio-track={track?.id ?? ''} data-audio-playing={enabled && track ? '1' : '0'}>
      <audio ref={audioRef} loop preload="none" className="hidden" />
      <span ref={ytHost} className="hidden" />
    </span>
  )
}
