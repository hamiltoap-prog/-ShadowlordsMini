import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { normalizeImageUrl } from '../../lib/imageUrl'
import { DEFAULT_ENTRANCE_MS, DEFAULT_TRANSITION_MS, normalizeSlide, visibleAtStep } from '../../lib/slides'
import type { SlideElemento, SlideForma, SlideImagem, SlideTexto, StorySlide } from '../../types'

/**
 * O palco de um slide: 16:9, com os elementos em camadas.
 *
 * É o MESMO desenho no editor, nas miniaturas e na apresentação — o que o
 * Mestre vê editando é exatamente o que a mesa vê. O palco é um "container" do
 * CSS e o texto mede `cqh` (% da altura do palco): o slide fica idêntico em
 * qualquer tamanho, sem quebrar linha diferente no celular.
 */

export const SLIDE_FONTS: Record<NonNullable<SlideTexto['fonte']>, string> = {
  titulo: 'var(--font-serif)',
  texto: 'var(--font-sans)',
  serifa: "Georgia, 'Times New Roman', serif",
}

const imageUrl = (u: string | undefined) => (u ? normalizeImageUrl(u) : '')

/** "#rrggbb" + opacidade → rgba(). */
export function hexWithAlpha(hex: string | undefined, alpha = 1): string {
  const h = (hex ?? '#000000').replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const v = Number.parseInt(n, 16)
  if (!Number.isFinite(v)) return `rgba(0,0,0,${alpha})`
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`
}

const GRADIENT_DIR: Record<string, string> = { baixo: 'to bottom', cima: 'to top', esquerda: 'to left', direita: 'to right' }

function Shape({ e }: { e: SlideForma }) {
  const background =
    e.degrade && e.degrade !== 'nenhum'
      ? `linear-gradient(${GRADIENT_DIR[e.degrade]}, ${hexWithAlpha(e.cor, 0)}, ${hexWithAlpha(e.cor, 1)})`
      : e.cor
  return (
    <div
      className="h-full w-full"
      style={{
        background,
        borderRadius: e.forma === 'elipse' ? '50%' : `${e.raio ?? 0}cqmin`,
        border: e.borda ? `0.4cqmin solid ${e.borda}` : undefined,
      }}
    />
  )
}

function ImageEl({ e }: { e: SlideImagem }) {
  const url = imageUrl(e.url)
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-white/30 text-[2cqh] text-white/40">
        sem imagem
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full select-none"
      style={{
        objectFit: e.fit ?? 'contain',
        borderRadius: `${e.raio ?? 0}cqmin`,
        // drop-shadow, e não box-shadow: a sombra segue o recorte do PNG.
        filter: e.sombra ? 'drop-shadow(0 1cqh 1.5cqh rgba(0,0,0,0.85))' : undefined,
        transform: e.espelhar ? 'scaleX(-1)' : undefined,
      }}
    />
  )
}

function TextEl({ e }: { e: SlideTexto }) {
  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[e.vertical ?? 'middle']
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        justifyContent: justify,
        background: e.fundo ? hexWithAlpha(e.fundo, e.fundoOpacidade ?? 0.6) : undefined,
        padding: e.fundo ? '1cqh 1.5cqh' : undefined,
        borderRadius: e.fundo ? '0.8cqh' : undefined,
      }}
    >
      <p
        className="m-0 whitespace-pre-wrap break-words"
        style={{
          fontSize: `${e.tamanho}cqh`,
          lineHeight: 1.18,
          color: e.cor,
          fontFamily: SLIDE_FONTS[e.fonte ?? 'titulo'],
          fontWeight: e.negrito ? 700 : e.fonte === 'texto' ? 400 : 600,
          fontStyle: e.italico ? 'italic' : undefined,
          textAlign: e.alinhamento ?? 'center',
          textShadow: e.sombra ? '0 0.25cqh 0.8cqh rgba(0,0,0,0.95), 0 0 0.3cqh rgba(0,0,0,0.9)' : undefined,
        }}
      >
        {e.texto}
      </p>
    </div>
  )
}

/**
 * Um elemento no palco, já posicionado. A caixa gira; a animação de entrada
 * fica numa `div` de dentro — se as duas usassem o mesmo `transform`, o giro
 * e a animação brigariam.
 */
export function StageElement({ e, animate, ghost = false }: { e: SlideElemento; animate: boolean; ghost?: boolean }) {
  const box: CSSProperties = {
    left: `${e.x * 100}%`,
    top: `${e.y * 100}%`,
    width: `${e.w * 100}%`,
    height: `${e.h * 100}%`,
    transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
    opacity: (e.opacity ?? 1) * (ghost ? 0.35 : 1),
  }
  const entrance = animate && e.entrada && e.entrada !== 'nenhuma' ? `slide-entra-${e.entrada}` : ''
  return (
    <div className="pointer-events-none absolute" style={box} data-slide-element={e.id}>
      <div
        className={`h-full w-full ${entrance}`}
        style={entrance ? { animationDuration: `${e.duracao ?? DEFAULT_ENTRANCE_MS}ms`, animationDelay: `${e.atraso ?? 0}ms` } : undefined}
      >
        {e.tipo === 'imagem' && <ImageEl e={e} />}
        {e.tipo === 'texto' && <TextEl e={e} />}
        {e.tipo === 'forma' && <Shape e={e} />}
      </div>
    </div>
  )
}

/**
 * O conteúdo de um slide (fundo + elementos), ocupando o pai inteiro. O pai é
 * que precisa ser o palco (`Stage`), para as medidas `cq*` valerem.
 *
 *  - `step`: até qual clique já foi revelado (elementos depois dele não aparecem);
 *  - `animate`: toca as entradas — na apresentação sim, nas miniaturas não;
 *  - `showAll`: o editor mostra tudo, e os elementos de clique ficam esmaecidos.
 */
export function SlideContent({
  slide,
  step = 0,
  animate = false,
  showAll = false,
}: {
  slide: StorySlide
  step?: number
  animate?: boolean
  showAll?: boolean
}) {
  const s = normalizeSlide(slide)
  const background = imageUrl(s.fundoUrl)
  // Elemento escondido não é desenhado. Ao ser revelado por um clique ele nasce
  // na tela e a entrada dele (CSS) toca uma vez, sozinha — e quem já estava não
  // repete a sua. Controlar "quem já animou" à mão era frágil.
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: s.fundoCor ?? '#000' }}>
      {background && (
        <img
          src={background}
          alt=""
          draggable={false}
          className={`pointer-events-none absolute inset-0 h-full w-full select-none ${animate && s.kenBurns ? 'slide-ken-burns' : ''}`}
          style={{ objectFit: s.fundoFit ?? 'cover' }}
        />
      )}
      {(s.elementos ?? []).map((e) => {
        if (!showAll && !visibleAtStep(e, step)) return null
        return <StageElement key={e.id} e={e} animate={animate} ghost={showAll && (e.passo ?? 0) > 0} />
      })}
    </div>
  )
}

/** O palco 16:9: um container do CSS, para o texto medir em % da altura. */
export function Stage({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '16 / 9', containerType: 'size', ...style }}>
      {children}
    </div>
  )
}

/**
 * A apresentação: um palco que troca de slide com transição.
 *
 * Quando o slide muda, o que sai continua desenhado (`data-slide-leaving`) até
 * a animação terminar — é isso que faz o "deslizar" mostrar os dois slides
 * andando juntos.
 */
export function ShowStage({
  slides,
  index,
  step,
  className = '',
  style,
}: {
  slides: readonly StorySlide[]
  index: number
  step: number
  className?: string
  style?: CSSProperties
}) {
  const current = slides[index]
  const [leaving, setLeaving] = useState<{ slide: StorySlide; step: number; key: number } | null>(null)
  const previous = useRef<{ index: number; slide?: StorySlide; step: number }>({ index, slide: current, step })
  const [key, setKey] = useState(0)

  useEffect(() => {
    const before = previous.current
    if (before.index !== index && before.slide) {
      const n = normalizeSlide(current ?? before.slide)
      const ms = n.transicaoMs ?? DEFAULT_TRANSITION_MS
      const kind = n.transicao ?? 'fade'
      setKey((k) => k + 1)
      if (kind !== 'nenhuma') {
        setLeaving({ slide: before.slide, step: before.step, key: Date.now() })
        const t = window.setTimeout(() => setLeaving(null), ms + 60)
        previous.current = { index, slide: current, step }
        return () => window.clearTimeout(t)
      }
      setLeaving(null)
    }
    previous.current = { index, slide: current, step }
  }, [index, current, step])

  if (!current) return null
  const n = normalizeSlide(current)
  const kind = n.transicao ?? 'fade'
  const ms = n.transicaoMs ?? DEFAULT_TRANSITION_MS
  // "Escurecer" passa pelo preto: o que sai apaga na primeira metade e o novo
  // acende na segunda.
  const timing = (side: 'in' | 'out'): CSSProperties =>
    kind === 'escurecer'
      ? { animationDuration: `${ms / 2}ms`, animationDelay: side === 'in' ? `${ms / 2}ms` : '0ms' }
      : { animationDuration: `${ms}ms` }

  return (
    <Stage className={`bg-black ${className}`} style={style}>
      {leaving && (
        <div key={`s${leaving.key}`} className={`absolute inset-0 slide-sai-${kind}`} style={timing('out')} data-slide-leaving="">
          <SlideContent slide={leaving.slide} step={leaving.step} />
        </div>
      )}
      <div
        key={`a${key}`}
        className={`absolute inset-0 ${leaving ? `slide-entra-tr-${kind}` : ''}`}
        style={leaving ? timing('in') : undefined}
        data-slide-current={index}
      >
        <SlideContent slide={current} step={step} animate />
      </div>
    </Stage>
  )
}
