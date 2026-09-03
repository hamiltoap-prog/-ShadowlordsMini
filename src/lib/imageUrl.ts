/** Extrai o ID de um link de compartilhamento do Google Drive, se houver. */
function extractDriveFileId(url: URL): string | null {
  const host = url.hostname
  if (host !== 'drive.google.com' && host !== 'drive.usercontent.google.com') return null

  // https://drive.google.com/file/d/<ID>/view?usp=sharing
  const fileMatch = url.pathname.match(/\/file\/d\/([\w-]{10,})/)
  if (fileMatch) return fileMatch[1]

  // https://drive.google.com/open?id=<ID>
  // https://drive.google.com/uc?id=<ID>&export=view
  // https://drive.google.com/thumbnail?id=<ID>
  // https://drive.usercontent.google.com/download?id=<ID>&export=view
  const idParam = url.searchParams.get('id')
  if (idParam && /^[\w-]{10,}$/.test(idParam)) return idParam

  return null
}

/**
 * Links de compartilhamento comuns do Google Drive (ex: ".../file/d/ID/view",
 * "drive.google.com/open?id=ID") não funcionam como `<img src>` direto — o
 * formato que funciona é `https://lh3.googleusercontent.com/d/ID`. Convertemos
 * automaticamente sempre que uma URL de imagem é salva; qualquer outro link
 * (incluindo um já no formato lh3) passa direto, sem alteração.
 */
export function normalizeImageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }
  const fileId = extractDriveFileId(parsed)
  return fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : trimmed
}
