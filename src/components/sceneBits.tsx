import { resolveCreaturePortrait } from '../data/creatureArt'
import { normalizeImageUrl } from '../lib/imageUrl'
import { KIND_STYLE } from '../lib/sceneStyle'
import type { SceneToken } from '../types'
import { CreatureImage } from './Portrait'
import { Input } from './ui'

/** Pedaços da tela de jogo usados tanto no palco quanto nos painéis do Mestre. */

export function SceneTokenThumb({ token }: { token: SceneToken }) {
  const image = resolveCreaturePortrait(token.label, token.imageUrl)
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ${KIND_STYLE[token.kind]}`}
    >
      {image ? (
        <CreatureImage url={image} alt={token.label} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] font-semibold text-white">{token.label.slice(0, 4)}</span>
      )}
    </div>
  )
}

/** Campo de texto que aceita link do Drive e o converte ao sair. */
export function ImageUrlInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <Input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={() => props.onChange(normalizeImageUrl(props.value))}
      placeholder={props.placeholder}
      className={props.className}
      style={props.style}
    />
  )
}
