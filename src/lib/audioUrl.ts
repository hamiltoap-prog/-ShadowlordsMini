/**
 * Entende os links que o Mestre cola na mesa de som.
 *
 * Dois caminhos: **YouTube**, tocado por um player embutido (o navegador não
 * reproduz um vídeo do YouTube num `<audio>`), e **áudio direto** — um endereço
 * que devolve o arquivo em si. Vários serviços de nuvem dão um link de
 * *visualização*, que abre uma página em vez do arquivo; para esses, convertemos
 * para a forma que serve o arquivo cru.
 *
 * O Google Drive é a exceção infeliz: ele não serve mais arquivo para outros
 * sites: mesmo público, o endereço de download responde com uma página de aviso
 * em vez do áudio. Continuamos aceitando o link (nada custa tentar), mas com um
 * aviso — porque o silêncio sem explicação foi o que mais atrapalhou aqui.
 */

export type AudioSource = 'youtube' | 'direct'
export type AudioProvider = 'youtube' | 'drive' | 'dropbox' | 'onedrive' | 'github' | 'other'

export interface ParsedAudio {
  source: AudioSource
  /** URL pronta para o `<audio>` (direct) ou o link original (youtube). */
  url: string
  /** De onde veio — usado para explicar direito quando algo não toca. */
  provider: AudioProvider
  /**
   * Outros endereços para o mesmo arquivo, tentados em ordem se o primeiro
   * falhar.
   */
  altUrls?: string[]
  /** Aviso a mostrar antes mesmo de tentar tocar. */
  warning?: string
  youtubeId?: string
}

export const DRIVE_WARNING =
  'O Google Drive não deixa outros sites tocarem o arquivo direto — mesmo público, ele responde com uma página de aviso no lugar do áudio. Prefira um link do YouTube, ou um endereço que sirva o MP3 cru (Dropbox, OneDrive, GitHub ou qualquer hospedagem de arquivo).'

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

/** Converte o que foi colado no que dá para tocar. */
export function parseAudioUrl(raw: string): ParsedAudio | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const youtubeId = extractYoutubeId(trimmed)
  if (youtubeId) return { source: 'youtube', url: trimmed, provider: 'youtube', youtubeId }

  const driveId = extractDriveFileId(trimmed)
  if (driveId) {
    return {
      source: 'direct',
      provider: 'drive',
      url: `https://drive.usercontent.google.com/download?id=${driveId}&export=download`,
      altUrls: [
        `https://drive.google.com/uc?export=download&id=${driveId}`,
        `https://docs.google.com/uc?export=download&id=${driveId}`,
        // O mesmo endereço que serve as imagens do Drive. Para áudio quase
        // nunca responde, mas é a última tentativa antes de desistir.
        `https://lh3.googleusercontent.com/d/${driveId}`,
      ],
      warning: DRIVE_WARNING,
    }
  }

  let parsed: URL | null = null
  try {
    parsed = new URL(trimmed)
  } catch {
    parsed = null
  }
  const host = parsed?.hostname.replace(/^www\./, '') ?? ''

  // Dropbox: o link de compartilhamento abre uma página; `raw=1` serve o arquivo.
  if (parsed && (host === 'dropbox.com' || host === 'dl.dropboxusercontent.com')) {
    const url = new URL(parsed.toString())
    url.hostname = 'dl.dropboxusercontent.com'
    url.searchParams.delete('dl')
    url.searchParams.set('raw', '1')
    return { source: 'direct', provider: 'dropbox', url: url.toString() }
  }

  // OneDrive / SharePoint: `download=1` troca a página pelo arquivo.
  if (parsed && (host === '1drv.ms' || host.endsWith('sharepoint.com') || host === 'onedrive.live.com')) {
    const url = new URL(parsed.toString())
    url.searchParams.set('download', '1')
    return { source: 'direct', provider: 'onedrive', url: url.toString() }
  }

  // GitHub: a página do arquivo vira o conteúdo cru.
  if (parsed && host === 'github.com') {
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
    if (match) {
      return {
        source: 'direct',
        provider: 'github',
        url: `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`,
      }
    }
  }

  return { source: 'direct', provider: 'other', url: trimmed }
}
