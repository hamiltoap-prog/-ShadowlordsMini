import { newId } from './id'
import type { SlideElemento, SlideForma, SlideImagem, SlideTexto, StorySlide } from '../types'

/**
 * As regras dos slides do modo apresentação, sem tela nenhuma: criar
 * elementos, mexer nas camadas, converter o formato antigo e decidir o que o
 * "próximo" do Mestre faz. Tudo puro — a tela só desenha o resultado.
 */

/** Proporção fixa do palco do slide. */
export const SLIDE_ASPECT = 16 / 9

/** Duração padrão da transição de slide e da entrada de elemento. */
export const DEFAULT_TRANSITION_MS = 700
export const DEFAULT_ENTRANCE_MS = 600

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function emptySlide(): StorySlide {
  return { id: newId(), fundoCor: '#000000', elementos: [], transicao: 'fade' }
}

export function newText(partial: Partial<SlideTexto> = {}): SlideTexto {
  return {
    id: newId(),
    tipo: 'texto',
    x: 0.1,
    y: 0.4,
    w: 0.8,
    h: 0.2,
    texto: 'Escreva aqui',
    tamanho: 7,
    cor: '#ffffff',
    fonte: 'titulo',
    alinhamento: 'center',
    vertical: 'middle',
    sombra: true,
    entrada: 'aparecer',
    ...partial,
  }
}

export function newImage(url: string, partial: Partial<SlideImagem> = {}): SlideImagem {
  return { id: newId(), tipo: 'imagem', x: 0.25, y: 0.2, w: 0.5, h: 0.6, url, fit: 'contain', entrada: 'aparecer', ...partial }
}

export function newShape(partial: Partial<SlideForma> = {}): SlideForma {
  return { id: newId(), tipo: 'forma', forma: 'retangulo', x: 0.3, y: 0.3, w: 0.4, h: 0.4, cor: '#000000', opacity: 0.6, ...partial }
}

/**
 * Slide no formato de agora. Os slides do formato antigo (imagem + título +
 * texto) viram fundo + faixa escura + dois textos, com a mesma cara que
 * tinham — e já abrem no editor como camadas editáveis. Slide novo passa
 * direto (a mesma referência).
 */
export function normalizeSlide(s: StorySlide): StorySlide {
  if (s.elementos) return s
  const elementos: SlideElemento[] = []
  const hasImage = Boolean(s.imageUrl)
  const hasText = Boolean(s.title || s.text)
  if (hasImage && hasText) {
    elementos.push(newShape({ id: `${s.id}-faixa`, x: 0, y: 0.55, w: 1, h: 0.45, cor: '#000000', opacity: 0.9, degrade: 'baixo', entrada: 'nenhuma', nome: 'faixa' }))
  }
  if (s.title) {
    elementos.push(
      newText({
        id: `${s.id}-titulo`,
        texto: s.title,
        x: 0.05,
        y: hasImage ? 0.68 : 0.25,
        w: 0.9,
        h: 0.12,
        tamanho: hasImage ? 6.5 : 9,
        alinhamento: hasImage ? 'left' : 'center',
        entrada: 'nenhuma',
        nome: 'título',
      }),
    )
  }
  if (s.text) {
    elementos.push(
      newText({
        id: `${s.id}-texto`,
        texto: s.text,
        x: 0.05,
        y: hasImage ? 0.8 : s.title ? 0.42 : 0.3,
        w: 0.9,
        h: hasImage ? 0.17 : 0.4,
        tamanho: hasImage ? 3.4 : 4.2,
        fonte: 'texto',
        alinhamento: hasImage ? 'left' : 'center',
        vertical: 'top',
        entrada: 'nenhuma',
        nome: 'texto',
      }),
    )
  }
  return {
    id: s.id,
    fundoCor: '#000000',
    fundoUrl: s.imageUrl,
    fundoFit: s.imageFit ?? 'contain',
    elementos,
    transicao: 'fade',
    notas: s.notas,
  }
}

/** Quantos cliques o slide tem antes de passar para o próximo. */
export function slideSteps(s: StorySlide): number {
  return Math.max(0, ...(normalizeSlide(s).elementos ?? []).map((e) => e.passo ?? 0))
}

/** O elemento aparece neste passo? */
export function visibleAtStep(e: SlideElemento, step: number): boolean {
  return (e.passo ?? 0) <= step
}

export interface SlidePosition {
  index: number
  step: number
}

/**
 * O "próximo" do Mestre: primeiro revela os cliques que faltam no slide;
 * depois passa de slide. No fim, fica onde está (`null`).
 */
export function advance(slides: readonly StorySlide[], p: SlidePosition): SlidePosition | null {
  const current = slides[p.index]
  if (!current) return null
  if (p.step < slideSteps(current)) return { index: p.index, step: p.step + 1 }
  if (p.index + 1 < slides.length) return { index: p.index + 1, step: 0 }
  return null
}

/** O "anterior": desfaz um clique; no começo do slide, volta ao anterior JÁ COMPLETO. */
export function goBack(slides: readonly StorySlide[], p: SlidePosition): SlidePosition | null {
  if (p.step > 0) return { index: p.index, step: p.step - 1 }
  if (p.index > 0) return { index: p.index - 1, step: slideSteps(slides[p.index - 1]) }
  return null
}

/** Mover uma camada: para a frente (em cima de tudo), para trás, ou um nível. */
export function moveLayer(
  elementos: readonly SlideElemento[],
  id: string,
  to: 'frente' | 'tras' | 'subir' | 'descer',
): SlideElemento[] {
  const i = elementos.findIndex((e) => e.id === id)
  if (i < 0) return [...elementos]
  const list = [...elementos]
  const [el] = list.splice(i, 1)
  const dest = to === 'frente' ? list.length : to === 'tras' ? 0 : to === 'subir' ? Math.min(list.length, i + 1) : Math.max(0, i - 1)
  list.splice(dest, 0, el)
  return list
}

/** Cópia com id novo, deslocada um pouco para não ficar em cima da original. */
export function duplicateElement(e: SlideElemento): SlideElemento {
  return { ...e, id: newId(), x: clamp(e.x + 0.03, 0, 1 - Math.min(e.w, 1)), y: clamp(e.y + 0.03, 0, 1 - Math.min(e.h, 1)) }
}

export function duplicateSlide(s: StorySlide): StorySlide {
  const n = normalizeSlide(s)
  return { ...n, id: newId(), elementos: (n.elementos ?? []).map((e) => ({ ...e, id: newId() })) }
}

/**
 * Prende o elemento ao palco: pode sair um pouco da borda (sangria, como num
 * editor de slides), mas nunca sumir de vez, e nunca fica minúsculo.
 */
export function keepOnStage<T extends SlideElemento>(e: T): T {
  const w = clamp(e.w, 0.02, 3)
  const h = clamp(e.h, 0.02, 3)
  return { ...e, w, h, x: clamp(e.x, -w + 0.02, 0.98), y: clamp(e.y, -h + 0.02, 0.98) }
}

/**
 * Ímã: encosta a borda ou o centro do elemento no centro e nas bordas do palco
 * quando passa perto. Devolve a posição ajustada e as guias a desenhar.
 */
export function snapToStage(
  e: Pick<SlideElemento, 'x' | 'y' | 'w' | 'h'>,
  tolerance = 0.012,
): { x: number; y: number; guidesX: number[]; guidesY: number[] } {
  const targets = [0, 0.5, 1]
  const guidesX: number[] = []
  const guidesY: number[] = []
  const pull = (pos: number, size: number, guides: number[]) => {
    for (const t of targets) {
      for (const [point, offset] of [
        [pos, 0],
        [pos + size / 2, size / 2],
        [pos + size, size],
      ] as const) {
        if (Math.abs(point - t) < tolerance) {
          guides.push(t)
          return t - offset
        }
      }
    }
    return pos
  }
  const x = pull(e.x, e.w, guidesX)
  const y = pull(e.y, e.h, guidesY)
  return { x, y, guidesX, guidesY }
}

/**
 * Os slides como vão para a tela dos jogadores: normalizados e SEM as notas do
 * Mestre. Se as notas fossem junto, qualquer jogador as leria pelo console do
 * navegador.
 */
export function slidesForShow(slides: readonly StorySlide[]): StorySlide[] {
  return slides.map((s) => {
    const copy = { ...normalizeSlide(s) }
    delete copy.notas
    return copy
  })
}

/** A primeira imagem da história, para a miniatura da biblioteca. */
export function storyCover(slides: readonly StorySlide[]): string | undefined {
  for (const s of slides) {
    const n = normalizeSlide(s)
    if (n.fundoUrl) return n.fundoUrl
    const img = (n.elementos ?? []).find((e): e is SlideImagem => e.tipo === 'imagem' && Boolean(e.url))
    if (img) return img.url
  }
  return undefined
}
