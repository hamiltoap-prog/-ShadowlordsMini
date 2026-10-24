import { useEffect, useState } from 'react'
import { normalizeImageUrl } from '../../lib/imageUrl'
import { advance, goBack, normalizeSlide, slideSteps, slidesForShow } from '../../lib/slides'
import { listenStoryShow, setStoryShow, updateStoryShow } from '../../lib/store'
import type { SceneLibraryItem, StoryShow } from '../../types'
import { Button, Select } from '../ui'
import { ShowStage } from './Stage'

/**
 * Modo apresentação na sessão.
 *
 * O Mestre monta os slides no editor, guarda na biblioteca e, na hora,
 * apresenta: a apresentação cobre a tela de jogo de todos. Só ele passa —
 * revelando primeiro os elementos "no clique" e depois trocando de slide, com
 * a transição de cada um — e fechar fecha para todos.
 *
 * O que está no ar mora em `scene/story`, legível por todos, com os slides
 * COPIADOS e sem as notas do Mestre: a biblioteca continua sendo bastidor, e
 * as notas ele lê da própria biblioteca. Quem entra no meio cai no slide (e no
 * clique) em que a mesa está.
 */

/** Começa a apresentar uma história da biblioteca para a mesa toda. */
export async function presentStory(tableId: string, item: SceneLibraryItem, index = 0) {
  await setStoryShow(tableId, {
    open: true,
    title: item.label,
    slides: slidesForShow(item.slides ?? []),
    index,
    step: 0,
    libraryId: item.id,
    updatedAt: Date.now(),
  })
}

/** A história no ar, ao vivo. */
export function useStoryShow(tableId: string, enabled = true) {
  const [show, setShow] = useState<StoryShow | null>(null)
  useEffect(() => {
    if (!enabled) return
    return listenStoryShow(tableId, setShow)
  }, [tableId, enabled])
  return show
}

/** Pré-carrega as imagens de um slide, para a troca não piscar. */
function preload(slide: ReturnType<typeof normalizeSlide> | undefined) {
  if (!slide) return
  const urls = [slide.fundoUrl, ...(slide.elementos ?? []).map((e) => (e.tipo === 'imagem' ? e.url : undefined))]
  for (const u of urls) {
    if (u) new Image().src = normalizeImageUrl(u)
  }
}

/** A camada da apresentação. Vive só na tela de jogo — nas fichas ela não aparece. */
export function StoryOverlay({
  tableId,
  isGM,
  library = [],
  enabled = true,
}: {
  tableId: string
  isGM: boolean
  /** A biblioteca do Mestre: é de lá que vêm as notas, que não vão ao ar. */
  library?: SceneLibraryItem[]
  /** Só escuta o banco com o login pronto. */
  enabled?: boolean
}) {
  const show = useStoryShow(tableId, enabled)
  // Minimizar é só do Mestre e só na tela dele: ele pode olhar o mapa sem
  // tirar a história da tela dos jogadores.
  const [minimized, setMinimized] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const slides = show?.slides ?? []
  const total = slides.length
  const index = Math.min(Math.max(0, show?.index ?? 0), Math.max(0, total - 1))
  const steps = slides[index] ? slideSteps(slides[index]) : 0
  const step = Math.min(Math.max(0, show?.step ?? 0), steps)
  const open = Boolean(show?.open && total > 0)
  const original = library.find((i) => i.id === show?.libraryId)
  const notes = isGM ? original?.slides?.[index]?.notas : undefined

  // Uma história nova sempre abre grande, mesmo se a anterior foi minimizada.
  useEffect(() => {
    if (show?.open) setMinimized(false)
  }, [show?.libraryId, show?.open])

  function go(p: { index: number; step: number } | null) {
    if (!isGM || !p) return
    void updateStoryShow(tableId, { index: p.index, step: p.step })
  }
  const next = () => go(advance(slides, { index, step }))
  const prev = () => go(goBack(slides, { index, step }))

  function closeForAll() {
    if (!isGM) return
    void updateStoryShow(tableId, { open: false })
  }

  // Teclado do Mestre: → / espaço / PageDown avançam; ← / PageUp voltam.
  useEffect(() => {
    if (!isGM || !open || minimized) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /input|textarea|select/i.test(target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        next()
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev()
      if (e.key === 'Escape') setMinimized(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Pré-carrega o próximo slide.
  useEffect(() => {
    if (open) preload(slides[index + 1] ? normalizeSlide(slides[index + 1]) : undefined)
  }, [open, index, show?.slides]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !show) return null

  if (isGM && minimized) {
    return (
      <div
        className="fixed bottom-3 left-1/2 z-[60] flex max-w-[calc(100vw-7rem)] -translate-x-1/2 flex-wrap items-center gap-2 border border-[color:var(--gold)] bg-black/90 px-3 py-1.5 text-xs text-white shadow-lg"
        data-story-minimized=""
      >
        <span>
          📖 {show.title} · slide {index + 1}/{total} na tela dos jogadores
        </span>
        <button className="text-[color:var(--gold)] hover:text-white" onClick={() => setMinimized(false)}>
          abrir
        </button>
        <button className="text-red-400 hover:text-red-200" onClick={closeForAll}>
          fechar para todos
        </button>
      </div>
    )
  }

  const atEnd = !advance(slides, { index, step })
  // A barra de baixo tira altura do palco; o palco é o maior 16:9 que cabe.
  const barHeight = isGM ? (notes && showNotes ? 150 : 52) : 34

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" data-story="" role="dialog" aria-label={show.title}>
      <div
        className={`flex min-h-0 flex-1 items-center justify-center ${isGM ? 'cursor-pointer' : ''}`}
        onClick={isGM ? next : undefined}
        title={isGM ? 'Clique para avançar' : undefined}
      >
        <ShowStage slides={slides} index={index} step={step} style={{ width: `min(100%, calc((100dvh - ${barHeight}px) * 16 / 9))` }} />
      </div>

      {isGM ? (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-[color:var(--gold-dark)] bg-black px-3 py-2 text-xs">
          {notes && showNotes && (
            <p
              className="max-h-24 overflow-y-auto whitespace-pre-line border border-amber-500/30 bg-amber-950/30 px-2 py-1 text-amber-100/90"
              data-gm-notes=""
            >
              <b className="text-amber-300">Notas (só você vê):</b> {notes}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[color:var(--gold)]">
              📖 {show.title}
              <Select
                value={index}
                onChange={(e) => go({ index: Number(e.target.value), step: 0 })}
                className="!w-28 !px-1 !py-0.5 text-[11px]"
                title="Ir para o slide"
                data-go-to=""
              >
                {slides.map((s, i) => (
                  <option key={s.id} value={i}>
                    slide {i + 1}/{total}
                  </option>
                ))}
              </Select>
              {steps > 0 && (
                <span className="text-[color:var(--gold-bright)]" data-clicks="">
                  clique {step}/{steps}
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-1.5" data-story-controls="">
              {notes && (
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setShowNotes((v) => !v)}>
                  {showNotes ? 'esconder notas' : 'notas'}
                </Button>
              )}
              <Button variant="secondary" className="px-3 py-1 text-xs" disabled={index === 0 && step === 0} onClick={prev}>
                ◀ anterior
              </Button>
              <Button variant="primary" className="px-3 py-1 text-xs" disabled={atEnd} onClick={next}>
                {step < steps ? 'revelar ▶' : 'próximo ▶'}
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                title="Some só da sua tela; os jogadores continuam vendo"
                onClick={() => setMinimized(true)}
              >
                minimizar
              </Button>
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={closeForAll}>
                fechar para todos
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-black px-3 py-1.5 text-[11px] text-[color:var(--gold)]/70">
          <span>
            📖 {show.title} · {index + 1}/{total}
          </span>
          <span>o Mestre está contando a história</span>
        </div>
      )}
    </div>
  )
}
