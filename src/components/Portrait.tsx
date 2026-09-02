import { useState } from 'react'

/** Retrato do personagem por URL, com fallback para a inicial do nome. */
export function Portrait({
  url,
  name,
  size = 48,
  ring = true,
}: {
  url?: string
  name: string
  size?: number
  ring?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }

  if (!url || failed) {
    return (
      <div
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-full bg-purple-900/50 font-serif text-purple-200 ${
          ring ? 'ring-2 ring-purple-700/50' : ''
        }`}
      >
        <span style={{ fontSize: size * 0.42 }}>{initial}</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={name}
      style={style}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-purple-700/50' : ''}`}
    />
  )
}
