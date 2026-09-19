/**
 * Entende os links que o Mestre cola na mesa de som.
 *
 * Dois caminhos: **YouTube**, tocado por um player embutido (o navegador não
 * reproduz um vídeo do YouTube num `<audio>`), e **áudio direto** — um .mp3 num
 * servidor qualquer ou um arquivo do Google Drive, que precisa virar a URL de
 * download para o `<audio>` conseguir tocar.
 */

export type AudioSource = 'youtube' | 'direct'

export interface ParsedAudio {
  source: AudioSource
  /** URL pronta para o `<audio>` (direct) ou o id do vídeo (youtube). */
  url: string
  youtubeId?: string
}

/** Id do vídeo, para qualquer formato de link do YouTube. */
export function extractYoutubeId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    // Já pode ser só o id colado direto.
    return /^[\w-]{11}$/.test(trimmed) ? trimmed : null
  }
  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '')

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    return /^[\w-]{11}$/.test(id) ? id : null
  }
  if (host !== 'youtube.com' && host !== 'music.youtube.com' && host !== 'youtube-nocookie.com') return null

  const v = parsed.searchParams.get('v')
  if (v && /^[\w-]{11}$/.test(v)) return v

  // /embed/<id>, /shorts/<id>, /live/<id>
  const pathMatch = parsed.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)
  return pathMatch ? pathMatch[1] : null
}

/** Id do arquivo num link de compartilhamento do Google Drive. */
export function extractDriveFileId(raw: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  const host = parsed.hostname
  if (host !== 'drive.google.com' && host !== 'drive.usercontent.google.com' && host !== 'docs.google.com') return null

  const fileMatch = parsed.pathname.match(/\/file\/d\/([\w-]{10,})/)
  if (fileMatch) return fileMatch[1]

  const idParam = parsed.searchParams.get('id')
  return idParam && /^[\w-]{10,}$/.test(idParam) ? idParam : null
}

/**
 * Converte o que foi colado no que dá para tocar. Links de compartilhamento do
 * Drive viram a URL de download direto, que é a que o `<audio>` aceita; o resto
 * passa como está.
 */
export function parseAudioUrl(raw: string): ParsedAudio | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const youtubeId = extractYoutubeId(trimmed)
  if (youtubeId) return { source: 'youtube', url: trimmed, youtubeId }

  const driveId = extractDriveFileId(trimmed)
  if (driveId) {
    return { source: 'direct', url: `https://drive.usercontent.google.com/download?id=${driveId}&export=download` }
  }

  return { source: 'direct', url: trimmed }
}
