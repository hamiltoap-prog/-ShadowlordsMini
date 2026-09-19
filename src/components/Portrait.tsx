import { useState } from 'react'

/** Retrato do personagem por URL, com fallback para a inicial do nome. */
export function Portrait({
  url,
  name,
  size = 48,
  ring = true,
  loading,
}: {
  url?: string
  name: string
  size?: number
  ring?: boolean
  /** "lazy" para listas longas, onde a maioria das fotos nasce fora da tela. */
  loading?: 'lazy' | 'eager'
}) {
  const [failed, setFailed] = useState(false)
  /**
   * Endereços do Drive levam a largura no fim ("...=w160"), para não baixar uma
   * imagem de 2 MB dentro de um círculo de 44px. Se essa forma falhar, ainda
   * vale tentar o endereço sem tamanho antes de desistir e mostrar a inicial.
   */
  const [fullSize, setFullSize] = useState(false)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }
  const sized = url?.match(/^(.*\/d\/[^=]+)=w\d+$/)
  const src = fullSize && sized ? sized[1] : url

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
      src={src}
      alt={name}
      style={style}
      loading={loading}
      onError={() => {
        if (sized && !fullSize) setFullSize(true)
        else setFailed(true)
      }}
      className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-purple-700/50' : ''}`}
    />
  )
}

/**
 * Imagem solta (sem o círculo do retrato) com a mesma rede de proteção: se o
 * endereço com largura do Drive falhar, tenta o endereço cheio antes de sumir.
 * Usada nas peças do mapa, que não são retratos mas vêm da mesma pasta de arte.
 */
export function CreatureImage({
  url,
  alt,
  className,
}: {
  url: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const [fullSize, setFullSize] = useState(false)
  const sized = url.match(/^(.*\/d\/[^=]+)=w\d+$/)

  if (failed) return null
  return (
    <img
      src={fullSize && sized ? sized[1] : url}
      alt={alt}
      draggable={false}
      onError={() => {
        if (sized && !fullSize) setFullSize(true)
        else setFailed(true)
      }}
      className={className}
    />
  )
}
