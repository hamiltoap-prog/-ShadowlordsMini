import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Button, Input, NumberInput, Select, Textarea } from '../ui'
import { SlideContent, Stage, ShowStage } from './Stage'
import { normalizeImageUrl } from '../../lib/imageUrl'
import { folderToSave, normalizePath, showPath } from '../../lib/folders'
import {
  DEFAULT_ENTRANCE_MS,
  DEFAULT_TRANSITION_MS,
  SLIDE_ASPECT,
  advance,
  duplicateElement,
  duplicateSlide,
  emptySlide,
  goBack,
  keepOnStage,
  moveLayer,
  newImage,
  newShape,
  newText,
  normalizeSlide,
  slideSteps,
  slidesForShow,
  snapToStage,
  storyCover,
  type SlidePosition,
} from '../../lib/slides'
import { addSceneLibraryItem, moveToFolder, updateSceneLibraryItem, updateStoryShow } from '../../lib/store'
import type {
  SceneLibraryItem,
  SlideElemento,
  SlideEntrada,
  SlideForma,
  SlideImagem,
  SlideTexto,
  SlideTransicao,
  StoryShow,
  StorySlide,
} from '../../types'

/**
 * Editor de história, no jeito de um editor de slides.
 *
 *  - à esquerda, os slides (miniaturas que são o próprio slide desenhado);
 *  - no centro, o palco: clicar seleciona, arrastar move, as alças
 *    redimensionam (Shift mantém a proporção), e o ímã encosta no centro e nas
 *    bordas (Alt solta o ímã);
 *  - à direita, as propriedades do que está selecionado — ou do slide, sem
 *    nada selecionado — e as camadas, de cima para baixo.
 *
 * Desfazer e refazer valem para tudo (Ctrl+Z / Ctrl+Y). "Testar" toca a
 * apresentação só na tela do Mestre, com as transições, antes de ir para a
 * mesa.
 */

const ENTRANCES: [SlideEntrada, string][] = [
  ['nenhuma', 'nenhuma'],
  ['aparecer', 'aparecer'],
  ['subir', 'subir'],
  ['descer', 'descer'],
  ['esquerda', 'vir da direita'],
  ['direita', 'vir da esquerda'],
  ['zoom', 'zoom'],
  ['desfocar', 'desfocar'],
]

const TRANSITIONS: [SlideTransicao, string][] = [
  ['fade', 'dissolver'],
  ['escurecer', 'escurecer (passa pelo preto)'],
  ['deslizar', 'deslizar para o lado'],
  ['empurrar-cima', 'empurrar para cima'],
  ['zoom', 'zoom'],
  ['cortina', 'cortina'],
  ['nenhuma', 'corte seco'],
]

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const HANDLE_POS: Record<Handle, string> = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
}

function elementLabel(e: SlideElemento): string {
  if (e.nome) return e.nome
  if (e.tipo === 'texto') return `"${e.texto.split('\n')[0].slice(0, 22) || 'texto'}"`
  if (e.tipo === 'imagem') {
    // O nome do arquivo diz qual imagem é ("goblin", "espada"); link do Drive não tem nome.
    const file = /drive|googleusercontent/i.test(e.url) ? '' : decodeURIComponent(e.url.split(/[?#]/)[0].split('/').pop() ?? '')
    return file.replace(/\.[a-z0-9]+$/i, '').slice(0, 24) || 'imagem'
  }
  return e.forma === 'elipse' ? 'círculo' : 'retângulo'
}
const ICON = { texto: 'T', imagem: '🖼', forma: '■' } as const

/** Proporção natural de uma imagem (altura/largura), para a caixa nascer sem distorcer. */
function imageRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Caixa (em frações do palco) para uma imagem de proporção `r` (altura/largura). */
function boxFor(r: number | null, maxW = 0.6, maxH = 0.8) {
  if (!r) return { w: maxW, h: maxH * 0.75 }
  let w = maxW
  let h = w * SLIDE_ASPECT * r
  if (h > maxH) {
    h = maxH
    w = h / (SLIDE_ASPECT * r)
  }
  return { w, h, x: (1 - w) / 2, y: (1 - h) / 2 }
}

export function StoryEditor({
  tableId,
  item,
  initialFolder,
  folders,
  show,
  onClose,
}: {
  tableId: string
  /** A história a editar; sem ela, é uma história nova. */
  item?: SceneLibraryItem
  initialFolder?: string
  /** As pastas que já existem na biblioteca, para sugerir no campo. */
  folders: readonly string[]
  /** O que está no ar: salvar uma história apresentada atualiza a mesa na hora. */
  show: StoryShow | null
  onClose: () => void
}) {
  const [title, setTitle] = useState(item?.label ?? '')
  const [folder, setFolder] = useState(showPath(item?.folder ?? initialFolder ?? ''))
  const [slides, setSlides] = useState<StorySlide[]>(() => (item?.slides?.length ? item.slides.map(normalizeSlide) : [emptySlide()]))
  const [current, setCurrent] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [testing, setTesting] = useState<SlidePosition | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [imageLink, setImageLink] = useState('')

  const slidesRef = useRef(slides)
  const past = useRef<StorySlide[][]>([])
  const future = useRef<StorySlide[][]>([])
  const lastKey = useRef<{ key: string; t: number }>({ key: '', t: 0 })
  const [, setHistoryVersion] = useState(0)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  const slide = slides[Math.min(current, slides.length - 1)]
  const elements = slide.elementos ?? []
  const selected = elements.find((e) => e.id === sel) ?? null

  /**
   * Toda mudança passa por aqui. Mudanças seguidas na mesma coisa (arrastar,
   * mexer num controle deslizante) viram um passo só do desfazer.
   */
  const change = useCallback((fn: (l: StorySlide[]) => StorySlide[], key = '') => {
    const before = slidesRef.current
    const after = fn(before)
    if (after === before) return
    const now = Date.now()
    const merge = key && lastKey.current.key === key && now - lastKey.current.t < 900
    if (!merge) {
      past.current.push(before)
      if (past.current.length > 100) past.current.shift()
      future.current = []
      setHistoryVersion((v) => v + 1)
    }
    lastKey.current = { key, t: now }
    slidesRef.current = after
    setSlides(after)
    setDirty(true)
  }, [])

  function undo() {
    const before = past.current.pop()
    if (!before) return
    future.current.push(slidesRef.current)
    lastKey.current = { key: '', t: 0 }
    slidesRef.current = before
    setSlides(before)
    setDirty(true)
    setHistoryVersion((v) => v + 1)
  }
  function redo() {
    const after = future.current.pop()
    if (!after) return
    past.current.push(slidesRef.current)
    lastKey.current = { key: '', t: 0 }
    slidesRef.current = after
    setSlides(after)
    setDirty(true)
    setHistoryVersion((v) => v + 1)
  }

  const changeSlide = useCallback(
    (fn: (s: StorySlide) => StorySlide, key = '') => {
      change((l) => l.map((s, i) => (i === Math.min(current, l.length - 1) ? fn(s) : s)), key)
    },
    [current, change],
  )

  const changeElement = useCallback(
    (id: string, patch: Partial<SlideElemento>, key = '') => {
      changeSlide((s) => ({ ...s, elementos: (s.elementos ?? []).map((e) => (e.id === id ? ({ ...e, ...patch } as SlideElemento) : e)) }), key)
    },
    [changeSlide],
  )

  function add(e: SlideElemento) {
    changeSlide((s) => ({ ...s, elementos: [...(s.elementos ?? []), e] }))
    setSel(e.id)
  }

  async function addImage() {
    const url = normalizeImageUrl(imageLink)
    if (!url) return
    add(newImage(url, boxFor(await imageRatio(url))))
    setImageLink('')
  }

  function removeSelected() {
    if (!sel) return
    changeSlide((s) => ({ ...s, elementos: (s.elementos ?? []).filter((e) => e.id !== sel) }))
    setSel(null)
  }

  function duplicateSelected() {
    if (!selected) return
    const copy = duplicateElement(selected)
    changeSlide((s) => {
      const l = [...(s.elementos ?? [])]
      l.splice(l.findIndex((e) => e.id === selected.id) + 1, 0, copy)
      return { ...s, elementos: l }
    })
    setSel(copy.id)
  }

  function layer(to: 'frente' | 'tras' | 'subir' | 'descer', id = sel) {
    if (!id) return
    changeSlide((s) => ({ ...s, elementos: moveLayer(s.elementos ?? [], id, to) }))
  }

  /* --- Arrastar e redimensionar no palco ---------------------------------- */
  const drag = useRef<{ id: string; mode: 'move' | Handle; x0: number; y0: number; orig: SlideElemento; key: string } | null>(null)

  function stagePoint(ev: { clientX: number; clientY: number }) {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return null
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }
  }

  function startDrag(ev: React.PointerEvent, e: SlideElemento, mode: 'move' | Handle) {
    ev.stopPropagation()
    ev.preventDefault()
    setSel(e.id)
    const p = stagePoint(ev)
    if (!p) return
    drag.current = { id: e.id, mode, x0: p.x, y0: p.y, orig: e, key: `drag:${e.id}:${Date.now()}` }
    stageRef.current?.setPointerCapture?.(ev.pointerId)
  }

  function moveDrag(ev: React.PointerEvent) {
    const a = drag.current
    if (!a) return
    const p = stagePoint(ev)
    if (!p) return
    const dx = p.x - a.x0
    const dy = p.y - a.y0
    const o = a.orig
    let { x, y, w, h } = o
    if (a.mode === 'move') {
      x = o.x + dx
      y = o.y + dy
      if (!ev.altKey) {
        const m = snapToStage({ x, y, w, h })
        x = m.x
        y = m.y
        setGuides({ x: m.guidesX, y: m.guidesY })
      } else setGuides({ x: [], y: [] })
    } else {
      const mode = a.mode
      if (mode.includes('e')) w = o.w + dx
      if (mode.includes('s')) h = o.h + dy
      if (mode.includes('w')) {
        w = o.w - dx
        x = o.x + dx
      }
      if (mode.includes('n')) {
        h = o.h - dy
        y = o.y + dy
      }
      // Pelos cantos, imagem mantém a proporção (Shift solta); o resto, só com Shift.
      const corner = mode.length === 2
      if (corner && (o.tipo === 'imagem') !== ev.shiftKey) {
        h = w * (o.h / o.w)
        if (mode.includes('n')) y = o.y + o.h - h
      }
      w = Math.max(0.02, w)
      h = Math.max(0.02, h)
    }
    changeElement(a.id, keepOnStage({ ...o, x, y, w, h }), a.key)
  }

  function endDrag() {
    drag.current = null
    setGuides({ x: [], y: [] })
  }

  /* --- Teclado ------------------------------------------------------------- */
  useEffect(() => {
    if (testing) return
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const typing = target && /input|textarea|select/i.test(target.tagName)
      const ctrl = ev.ctrlKey || ev.metaKey
      if (ctrl && ev.key.toLowerCase() === 'z' && !typing) {
        ev.preventDefault()
        if (ev.shiftKey) redo()
        else undo()
        return
      }
      if (ctrl && ev.key.toLowerCase() === 'y' && !typing) {
        ev.preventDefault()
        redo()
        return
      }
      if (typing) return
      if (ctrl && ev.key.toLowerCase() === 'd') {
        ev.preventDefault()
        duplicateSelected()
        return
      }
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel) {
        ev.preventDefault()
        removeSelected()
        return
      }
      if (ev.key === 'Escape') setSel(null)
      if (selected && ev.key.startsWith('Arrow')) {
        ev.preventDefault()
        const step = ev.shiftKey ? 0.02 : 0.005
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key] ?? [0, 0]
        changeElement(selected.id, keepOnStage({ ...selected, x: selected.x + d[0], y: selected.y + d[1] }), `arrows:${selected.id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* --- Slides -------------------------------------------------------------- */
  function addSlide() {
    const s = emptySlide()
    change((l) => {
      const n = [...l]
      // O slide novo herda a transição do atual: a história fica com um ritmo só.
      n.splice(current + 1, 0, { ...s, transicao: l[current]?.transicao ?? 'fade', transicaoMs: l[current]?.transicaoMs })
      return n
    })
    setCurrent(current + 1)
    setSel(null)
  }
  function moveSlide(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= slides.length) return
    change((l) => {
      const n = [...l]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
    setCurrent(j)
  }
  function copySlide(i: number) {
    change((l) => {
      const n = [...l]
      n.splice(i + 1, 0, duplicateSlide(l[i]))
      return n
    })
    setCurrent(i + 1)
  }
  function removeSlide(i: number) {
    if (slides.length === 1) {
      change(() => [emptySlide()])
      setSel(null)
      return
    }
    change((l) => l.filter((_, k) => k !== i))
    setCurrent(Math.max(0, Math.min(i, slides.length - 2)))
    setSel(null)
  }

  /* --- Salvar -------------------------------------------------------------- */
  async function save(close = true) {
    setSaving(true)
    try {
      const label = title.trim() || 'História sem nome'
      const cover = storyCover(slides)
      const path = folderToSave(folder)
      if (item) {
        await updateSceneLibraryItem(tableId, item.id, { label, folder: path, slides, imageUrl: cover, updatedAt: Date.now() })
        // Tirar da pasta é apagar o campo — o `update` ignora o que é vazio.
        if (!path && item.folder) await moveToFolder(tableId, 'sceneLibrary', item.id, undefined)
        // Corrigiu uma história que está no ar: a mesa vê a correção na hora.
        if (show?.open && show.libraryId === item.id) {
          await updateStoryShow(tableId, {
            title: label,
            slides: slidesForShow(slides),
            index: Math.min(show.index, slides.length - 1),
            step: 0,
          })
        }
      } else {
        await addSceneLibraryItem(tableId, { kind: 'story', label, folder: path, imageUrl: cover, slides, createdAt: Date.now() })
      }
      setDirty(false)
      if (close) onClose()
    } finally {
      setSaving(false)
    }
  }

  function close() {
    if (dirty && !window.confirm('Fechar sem salvar? As mudanças desde o último salvamento se perdem.')) return
    onClose()
  }

  const maxStep = slideSteps(slide)

  /* --- Tela ----------------------------------------------------------------- */
  // Em portal, direto no corpo da página: o editor nasce dentro do painel da
  // biblioteca, e lá dentro ficaria por baixo da barra da tela de jogo.
  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-[#0b0e14] text-white" data-story-editor="">
      {/* Barra de cima */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--gold-dark)] bg-black px-3 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da história"
          style={{ width: '14rem' }}
          className="!py-1 text-sm"
          data-story-title=""
        />
        <Input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="pasta: Arco 1 > Masmorra"
          list="story-folders"
          style={{ width: '12rem' }}
          className="!py-1 text-xs"
          data-story-folder=""
        />
        <datalist id="story-folders">
          {folders.map((p) => (
            <option key={p} value={showPath(p)} />
          ))}
        </datalist>
        {normalizePath(folder) && (
          <span className="hidden text-[11px] text-purple-400/60 md:inline">→ 📁 {showPath(normalizePath(folder))}</span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={past.current.length === 0} onClick={undo} title="Ctrl+Z">
            ↶ desfazer
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={future.current.length === 0} onClick={redo} title="Ctrl+Y">
            ↷ refazer
          </Button>
          <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setTesting({ index: current, step: 0 })} data-test-story="">
            ▶ testar daqui
          </Button>
          {item && (
            <Button variant="secondary" className="px-2 py-1 text-xs" disabled={saving} onClick={() => save(false)}>
              salvar
            </Button>
          )}
          <Button variant="primary" className="px-3 py-1 text-xs" disabled={saving} onClick={() => save(true)} data-save-story="">
            {item ? 'salvar e fechar' : 'guardar na biblioteca'}
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={close}>
            fechar
          </Button>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Slides */}
        <div
          className="flex shrink-0 gap-2 overflow-x-auto border-b border-[color:var(--gold-dark)] p-2 lg:w-44 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
          data-thumbnails=""
        >
          {slides.map((s, i) => (
            <div key={s.id} className="flex w-36 shrink-0 flex-col gap-0.5 lg:w-full">
              <button
                onClick={() => {
                  setCurrent(i)
                  setSel(null)
                }}
                className={`relative text-left outline-none ring-2 ${i === current ? 'ring-[color:var(--gold)]' : 'ring-transparent hover:ring-white/30'}`}
                data-thumbnail={i}
              >
                <Stage className="pointer-events-none w-full">
                  <SlideContent slide={s} showAll />
                </Stage>
                <span className="absolute left-1 top-0.5 bg-black/70 px-1 text-[10px]">{i + 1}</span>
              </button>
              {i === current && (
                <span className="flex justify-between text-[10px] text-[color:var(--gold)]/80">
                  <button disabled={i === 0} className="disabled:opacity-30" onClick={() => moveSlide(i, -1)} title="Mover para cima">
                    ▲
                  </button>
                  <button disabled={i === slides.length - 1} className="disabled:opacity-30" onClick={() => moveSlide(i, 1)} title="Mover para baixo">
                    ▼
                  </button>
                  <button onClick={() => copySlide(i)}>duplicar</button>
                  <button className="text-red-400" onClick={() => removeSlide(i)}>
                    apagar
                  </button>
                </span>
              )}
            </div>
          ))}
          <Button variant="secondary" className="w-36 shrink-0 py-1 text-xs lg:w-full" onClick={addSlide} data-add-slide="">
            + slide
          </Button>
        </div>

        {/* Palco */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[color:var(--gold-dark)] px-3 py-1.5" data-tools="">
            <Button variant="secondary" className="px-2 py-0.5 text-[11px]" onClick={() => add(newText())} data-add-title="">
              + Título
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-0.5 text-[11px]"
              onClick={() =>
                add(newText({ texto: 'Texto da narração', tamanho: 3.6, fonte: 'texto', alinhamento: 'left', vertical: 'top', y: 0.62, h: 0.3 }))
              }
              data-add-text=""
            >
              + Texto
            </Button>
            <Button variant="secondary" className="px-2 py-0.5 text-[11px]" onClick={() => add(newShape())}>
              + Retângulo
            </Button>
            <Button variant="secondary" className="px-2 py-0.5 text-[11px]" onClick={() => add(newShape({ forma: 'elipse', w: 0.25, h: 0.444 }))}>
              + Círculo
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-0.5 text-[11px]"
              title="Degradê escuro na parte de baixo, para o texto ler bem em cima da imagem"
              onClick={() =>
                add(newShape({ x: 0, y: 0.5, w: 1, h: 0.5, cor: '#000000', opacity: 0.9, degrade: 'baixo', entrada: 'aparecer', nome: 'faixa escura' }))
              }
            >
              + Faixa escura
            </Button>
            <span className="flex items-center gap-1">
              <Input
                value={imageLink}
                onChange={(e) => setImageLink(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addImage()}
                placeholder="link da imagem (Drive serve)"
                style={{ width: '13rem' }}
                className="!px-2 !py-0.5 text-[11px]"
                data-image-link=""
              />
              <Button variant="primary" className="px-2 py-0.5 text-[11px]" disabled={!imageLink.trim()} onClick={() => void addImage()} data-add-image="">
                + Imagem
              </Button>
            </span>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#14161c] p-3" onPointerDown={() => setSel(null)}>
            <div
              ref={stageRef}
              className="relative shadow-[0_0_0_1px_rgba(200,170,110,0.25),0_10px_40px_rgba(0,0,0,0.6)]"
              style={{ width: `min(100%, calc((100dvh - 220px) * ${SLIDE_ASPECT}))`, aspectRatio: '16 / 9', touchAction: 'none' }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              data-editor-stage=""
            >
              <Stage className="absolute inset-0">
                <SlideContent slide={slide} showAll />
              </Stage>
              {/* Caixas de seleção, por cima do desenho. */}
              {elements.map((e) => {
                const active = e.id === sel
                return (
                  <div
                    key={e.id}
                    className={`absolute cursor-move ${active ? 'outline outline-2 outline-[color:var(--gold)]' : 'hover:outline hover:outline-1 hover:outline-white/50'}`}
                    style={{
                      left: `${e.x * 100}%`,
                      top: `${e.y * 100}%`,
                      width: `${e.w * 100}%`,
                      height: `${e.h * 100}%`,
                      transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
                    }}
                    onPointerDown={(ev) => startDrag(ev, e, 'move')}
                    onDoubleClick={() => e.tipo === 'texto' && textRef.current?.focus()}
                    data-box={elementLabel(e)}
                  >
                    {(e.passo ?? 0) > 0 && (
                      <span className="pointer-events-none absolute -top-4 left-0 bg-[color:var(--gold)] px-1 text-[9px] font-bold text-black">
                        clique {e.passo}
                      </span>
                    )}
                    {active &&
                      HANDLES.map((h) => (
                        <span
                          key={h}
                          className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-black bg-white ${HANDLE_POS[h]}`}
                          onPointerDown={(ev) => startDrag(ev, e, h)}
                          data-handle={h}
                        />
                      ))}
                  </div>
                )
              })}
              {guides.x.map((g) => (
                <div key={`gx${g}`} className="pointer-events-none absolute top-0 h-full w-px bg-fuchsia-400" style={{ left: `${g * 100}%` }} />
              ))}
              {guides.y.map((g) => (
                <div key={`gy${g}`} className="pointer-events-none absolute left-0 h-px w-full bg-fuchsia-400" style={{ top: `${g * 100}%` }} />
              ))}
            </div>
          </div>
          <p className="hidden border-t border-[color:var(--gold-dark)] px-3 py-1 text-[10px] text-purple-400/60 md:block">
            Arraste para mover · alças para redimensionar (imagem mantém a proporção; Shift solta) · Alt solta o ímã · setas ajustam ·
            Delete apaga · Ctrl+D duplica · Ctrl+Z desfaz · duplo clique no texto edita
          </p>
        </div>

        {/* Propriedades */}
        <div
          className="flex shrink-0 flex-col gap-3 overflow-y-auto border-t border-[color:var(--gold-dark)] p-3 text-xs lg:w-80 lg:border-l lg:border-t-0"
          data-properties=""
        >
          {selected ? (
            <ElementPanel
              e={selected}
              maxStep={maxStep}
              textRef={textRef}
              change={(patch, key) => changeElement(selected.id, patch, key ? `${selected.id}:${key}` : '')}
              layer={layer}
              duplicate={duplicateSelected}
              remove={removeSelected}
            />
          ) : (
            <SlidePanel slide={slide} change={(patch, key) => changeSlide((s) => ({ ...s, ...patch }), key ? `slide:${key}` : '')} />
          )}

          <Section title={`Camadas (${elements.length})`}>
            {elements.length === 0 && <p className="text-purple-400/60">Slide vazio. Use a barra acima do palco.</p>}
            {[...elements].reverse().map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-1.5 px-1.5 py-1 ${e.id === sel ? 'bg-[color:var(--gold)]/20 text-white' : 'text-purple-200 hover:bg-white/5'}`}
                data-layer={elementLabel(e)}
              >
                <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setSel(e.id)}>
                  <span className="w-4 text-center">{ICON[e.tipo]}</span>
                  <span className="truncate">{elementLabel(e)}</span>
                  {(e.passo ?? 0) > 0 && <span className="text-[9px] text-[color:var(--gold)]">clique {e.passo}</span>}
                </button>
                <button title="Subir uma camada" onClick={() => layer('subir', e.id)}>
                  ▲
                </button>
                <button title="Descer uma camada" onClick={() => layer('descer', e.id)}>
                  ▼
                </button>
              </div>
            ))}
          </Section>
        </div>
      </div>

      {testing && <StoryTest slides={slides} start={testing} title={title || 'História sem nome'} onExit={() => setTesting(null)} />}
    </div>,
    document.body,
  )
}

/* --- Painéis ----------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-serif text-[10px] uppercase tracking-[0.14em] text-[color:var(--gold)]/80">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-purple-200/80">
      <span className="w-20 shrink-0">{label}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
    </label>
  )
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  suffix = '',
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[color:var(--gold)]"
      />
      <span className="w-10 text-right font-mono text-[10px]">
        {Math.round(value * 10) / 10}
        {suffix}
      </span>
    </>
  )
}

function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-10 cursor-pointer border border-[color:var(--gold-dark)] bg-transparent"
      />
      <span className="font-mono text-[10px] text-purple-400/70">{value}</span>
    </>
  )
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-purple-200">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-[color:var(--gold)]" />
      {label}
    </label>
  )
}

function ElementPanel({
  e,
  maxStep,
  textRef,
  change,
  layer,
  duplicate,
  remove,
}: {
  e: SlideElemento
  maxStep: number
  textRef: RefObject<HTMLTextAreaElement | null>
  change: (patch: Partial<SlideElemento>, key?: string) => void
  layer: (to: 'frente' | 'tras' | 'subir' | 'descer') => void
  duplicate: () => void
  remove: () => void
}) {
  const pct = (v: number) => Math.round(v * 1000) / 10
  return (
    <>
      <Section title={e.tipo === 'texto' ? 'Texto' : e.tipo === 'imagem' ? 'Imagem' : 'Forma'}>
        <Row label="nome da camada">
          <Input
            value={e.nome ?? ''}
            onChange={(ev) => change({ nome: ev.target.value || undefined }, 'nome')}
            placeholder={elementLabel({ ...e, nome: undefined })}
            className="!py-0.5 text-xs"
          />
        </Row>
        {e.tipo === 'texto' && <TextFields e={e} change={change} textRef={textRef} />}
        {e.tipo === 'imagem' && <ImageFields e={e} change={change} />}
        {e.tipo === 'forma' && <ShapeFields e={e} change={change} />}
      </Section>

      <Section title="Posição e tamanho (% do slide)">
        <div className="grid grid-cols-4 gap-1">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k} className="flex flex-col text-[10px] text-purple-400/70">
              {{ x: 'X', y: 'Y', w: 'largura', h: 'altura' }[k]}
              <NumberInput
                step={0.5}
                value={pct(e[k])}
                onChange={(v) => change(keepOnStage({ ...e, [k]: v / 100 }), `pos-${k}`)}
                className="!px-1 !py-0.5 text-xs"
                data-pos={k}
              />
            </label>
          ))}
        </div>
        <span className="flex flex-wrap gap-1">
          <Button variant="ghost" className="px-1.5 py-0.5 text-[10px]" onClick={() => change({ x: (1 - e.w) / 2 })}>
            centralizar ↔
          </Button>
          <Button variant="ghost" className="px-1.5 py-0.5 text-[10px]" onClick={() => change({ y: (1 - e.h) / 2 })}>
            centralizar ↕
          </Button>
          <Button variant="ghost" className="px-1.5 py-0.5 text-[10px]" onClick={() => change({ x: 0, y: 0, w: 1, h: 1 })}>
            ocupar o slide
          </Button>
        </span>
        <Row label="giro">
          <Slider value={e.rotation ?? 0} min={-180} max={180} step={1} suffix="°" onChange={(v) => change({ rotation: v || undefined }, 'giro')} />
        </Row>
        <Row label="opacidade">
          <Slider value={(e.opacity ?? 1) * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => change({ opacity: v / 100 }, 'opac')} />
        </Row>
      </Section>

      <Section title="Camada">
        <span className="grid grid-cols-2 gap-1">
          <Button variant="secondary" className="px-1.5 py-0.5 text-[10px]" onClick={() => layer('frente')} data-bring-front="">
            trazer para a frente
          </Button>
          <Button variant="secondary" className="px-1.5 py-0.5 text-[10px]" onClick={() => layer('tras')} data-send-back="">
            enviar para trás
          </Button>
          <Button variant="ghost" className="px-1.5 py-0.5 text-[10px]" onClick={() => layer('subir')}>
            ▲ subir um nível
          </Button>
          <Button variant="ghost" className="px-1.5 py-0.5 text-[10px]" onClick={() => layer('descer')}>
            ▼ descer um nível
          </Button>
        </span>
      </Section>

      <Section title="Animação na apresentação">
        <Row label="entrada">
          <Select value={e.entrada ?? 'nenhuma'} onChange={(ev) => change({ entrada: ev.target.value as SlideEntrada })} className="!py-0.5 text-xs" data-entrance="">
            {ENTRANCES.map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </Select>
        </Row>
        <Row label="aparece">
          <Select value={e.passo ?? 0} onChange={(ev) => change({ passo: Number(ev.target.value) || undefined })} className="!py-0.5 text-xs" data-step="">
            <option value={0}>junto com o slide</option>
            {Array.from({ length: maxStep + 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                no {n}º clique do Mestre
              </option>
            ))}
          </Select>
        </Row>
        {(e.entrada ?? 'nenhuma') !== 'nenhuma' && (
          <>
            <Row label="atraso">
              <Slider value={(e.atraso ?? 0) / 1000} min={0} max={5} step={0.1} suffix="s" onChange={(v) => change({ atraso: Math.round(v * 1000) || undefined }, 'atraso')} />
            </Row>
            <Row label="duração">
              <Slider
                value={(e.duracao ?? DEFAULT_ENTRANCE_MS) / 1000}
                min={0.2}
                max={4}
                step={0.1}
                suffix="s"
                onChange={(v) => change({ duracao: Math.round(v * 1000) }, 'duracao')}
              />
            </Row>
          </>
        )}
      </Section>

      <span className="flex gap-1.5">
        <Button variant="secondary" className="flex-1 py-1 text-[11px]" onClick={duplicate}>
          duplicar
        </Button>
        <Button variant="danger" className="flex-1 py-1 text-[11px]" onClick={remove} data-remove-element="">
          apagar
        </Button>
      </span>
    </>
  )
}

function TextFields({
  e,
  change,
  textRef,
}: {
  e: SlideTexto
  change: (patch: Partial<SlideTexto>, key?: string) => void
  textRef: RefObject<HTMLTextAreaElement | null>
}) {
  return (
    <>
      <Textarea ref={textRef} rows={4} value={e.texto} onChange={(ev) => change({ texto: ev.target.value }, 'texto')} className="text-xs" data-element-text="" />
      <Row label="tamanho">
        <Slider value={e.tamanho} min={1} max={25} step={0.1} onChange={(v) => change({ tamanho: v }, 'tamanho')} />
      </Row>
      <Row label="cor">
        <Color value={e.cor} onChange={(v) => change({ cor: v }, 'cor')} />
      </Row>
      <Row label="fonte">
        <Select value={e.fonte ?? 'titulo'} onChange={(ev) => change({ fonte: ev.target.value as SlideTexto['fonte'] })} className="!py-0.5 text-xs">
          <option value="titulo">Título (Cinzel)</option>
          <option value="texto">Texto (Barlow)</option>
          <option value="serifa">Serifa (Georgia)</option>
        </Select>
      </Row>
      <Row label="alinhar">
        {(['left', 'center', 'right'] as const).map((a) => (
          <Button key={a} variant={(e.alinhamento ?? 'center') === a ? 'primary' : 'ghost'} className="px-2 py-0.5 text-[10px]" onClick={() => change({ alinhamento: a })}>
            {{ left: 'esq.', center: 'centro', right: 'dir.' }[a]}
          </Button>
        ))}
      </Row>
      <Row label="na caixa">
        {(['top', 'middle', 'bottom'] as const).map((a) => (
          <Button key={a} variant={(e.vertical ?? 'middle') === a ? 'primary' : 'ghost'} className="px-2 py-0.5 text-[10px]" onClick={() => change({ vertical: a })}>
            {{ top: 'topo', middle: 'meio', bottom: 'base' }[a]}
          </Button>
        ))}
      </Row>
      <span className="flex flex-wrap gap-3">
        <Check label="negrito" value={Boolean(e.negrito)} onChange={(v) => change({ negrito: v })} />
        <Check label="itálico" value={Boolean(e.italico)} onChange={(v) => change({ italico: v })} />
        <Check label="contorno" value={Boolean(e.sombra)} onChange={(v) => change({ sombra: v })} />
        <Check label="fundo" value={Boolean(e.fundo)} onChange={(v) => change({ fundo: v ? '#000000' : undefined })} />
      </span>
      {e.fundo && (
        <>
          <Row label="cor do fundo">
            <Color value={e.fundo} onChange={(v) => change({ fundo: v }, 'fundo')} />
          </Row>
          <Row label="fundo visível">
            <Slider value={(e.fundoOpacidade ?? 0.6) * 100} min={0} max={100} step={1} suffix="%" onChange={(v) => change({ fundoOpacidade: v / 100 }, 'fundoop')} />
          </Row>
        </>
      )}
    </>
  )
}

function ImageFields({ e, change }: { e: SlideImagem; change: (patch: Partial<SlideImagem>, key?: string) => void }) {
  const [link, setLink] = useState(e.url)
  useEffect(() => setLink(e.url), [e.url])
  return (
    <>
      <Row label="link">
        <Input value={link} onChange={(ev) => setLink(ev.target.value)} onBlur={() => link !== e.url && change({ url: normalizeImageUrl(link) })} className="!py-0.5 text-xs" />
      </Row>
      <Row label="encaixe">
        <Select value={e.fit ?? 'contain'} onChange={(ev) => change({ fit: ev.target.value as 'cover' | 'contain' })} className="!py-0.5 text-xs">
          <option value="contain">imagem inteira</option>
          <option value="cover">preencher a caixa (recorta)</option>
        </Select>
      </Row>
      <Button
        variant="ghost"
        className="self-start px-1.5 py-0.5 text-[10px]"
        title="Ajusta a altura da caixa à proporção da imagem"
        onClick={async () => {
          const r = await imageRatio(normalizeImageUrl(e.url))
          if (r) change({ h: e.w * SLIDE_ASPECT * r })
        }}
      >
        proporção original
      </Button>
      <Row label="cantos">
        <Slider value={e.raio ?? 0} min={0} max={30} step={0.5} onChange={(v) => change({ raio: v || undefined }, 'raio')} />
      </Row>
      <span className="flex flex-wrap gap-3">
        <Check label="sombra (PNG)" value={Boolean(e.sombra)} onChange={(v) => change({ sombra: v })} />
        <Check label="espelhar" value={Boolean(e.espelhar)} onChange={(v) => change({ espelhar: v })} />
      </span>
    </>
  )
}

function ShapeFields({ e, change }: { e: SlideForma; change: (patch: Partial<SlideForma>, key?: string) => void }) {
  return (
    <>
      <Row label="forma">
        <Select value={e.forma} onChange={(ev) => change({ forma: ev.target.value as SlideForma['forma'] })} className="!py-0.5 text-xs">
          <option value="retangulo">retângulo</option>
          <option value="elipse">círculo / elipse</option>
        </Select>
      </Row>
      <Row label="cor">
        <Color value={e.cor} onChange={(v) => change({ cor: v }, 'cor')} />
      </Row>
      <Row label="degradê">
        <Select value={e.degrade ?? 'nenhum'} onChange={(ev) => change({ degrade: ev.target.value as SlideForma['degrade'] })} className="!py-0.5 text-xs">
          <option value="nenhum">cor sólida</option>
          <option value="baixo">mais forte embaixo</option>
          <option value="cima">mais forte em cima</option>
          <option value="esquerda">mais forte à esquerda</option>
          <option value="direita">mais forte à direita</option>
        </Select>
      </Row>
      {e.forma === 'retangulo' && (
        <Row label="cantos">
          <Slider value={e.raio ?? 0} min={0} max={30} step={0.5} onChange={(v) => change({ raio: v || undefined }, 'raio')} />
        </Row>
      )}
      <Check label="borda" value={Boolean(e.borda)} onChange={(v) => change({ borda: v ? '#c8aa6e' : undefined })} />
      {e.borda && (
        <Row label="cor da borda">
          <Color value={e.borda} onChange={(v) => change({ borda: v }, 'borda')} />
        </Row>
      )}
    </>
  )
}

function SlidePanel({ slide, change }: { slide: StorySlide; change: (patch: Partial<StorySlide>, key?: string) => void }) {
  const [link, setLink] = useState(slide.fundoUrl ?? '')
  useEffect(() => setLink(slide.fundoUrl ?? ''), [slide.id, slide.fundoUrl])
  return (
    <>
      <Section title="Slide">
        <p className="text-purple-400/60">Nada selecionado: estas são as opções do slide inteiro.</p>
        <Row label="cor de fundo">
          <Color value={slide.fundoCor ?? '#000000'} onChange={(v) => change({ fundoCor: v }, 'fundocor')} />
        </Row>
        <Row label="imagem de fundo">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => link !== (slide.fundoUrl ?? '') && change({ fundoUrl: normalizeImageUrl(link) || undefined })}
            placeholder="link (Drive serve)"
            className="!py-0.5 text-xs"
            data-slide-background=""
          />
        </Row>
        {slide.fundoUrl && (
          <>
            <Row label="encaixe">
              <Select value={slide.fundoFit ?? 'cover'} onChange={(e) => change({ fundoFit: e.target.value as 'cover' | 'contain' })} className="!py-0.5 text-xs">
                <option value="cover">preencher o slide</option>
                <option value="contain">imagem inteira</option>
              </Select>
            </Row>
            <Check label="zoom lento no fundo (efeito cinema)" value={Boolean(slide.kenBurns)} onChange={(v) => change({ kenBurns: v || undefined })} />
          </>
        )}
      </Section>
      <Section title="Transição de entrada deste slide">
        <Row label="efeito">
          <Select value={slide.transicao ?? 'fade'} onChange={(e) => change({ transicao: e.target.value as SlideTransicao })} className="!py-0.5 text-xs" data-transition="">
            {TRANSITIONS.map(([k, r]) => (
              <option key={k} value={k}>
                {r}
              </option>
            ))}
          </Select>
        </Row>
        {(slide.transicao ?? 'fade') !== 'nenhuma' && (
          <Row label="duração">
            <Slider
              value={(slide.transicaoMs ?? DEFAULT_TRANSITION_MS) / 1000}
              min={0.2}
              max={4}
              step={0.1}
              suffix="s"
              onChange={(v) => change({ transicaoMs: Math.round(v * 1000) }, 'trms')}
            />
          </Row>
        )}
      </Section>
      <Section title="Notas do Mestre">
        <Textarea
          rows={4}
          value={slide.notas ?? ''}
          onChange={(e) => change({ notas: e.target.value || undefined }, 'notas')}
          placeholder="O que você quer lembrar enquanto narra. Só você vê — não vai para a tela dos jogadores."
          className="text-xs"
          data-notes=""
        />
      </Section>
    </>
  )
}

/** "Testar": a apresentação só na tela do Mestre, para conferir transições e cliques. */
function StoryTest({ slides, start, title, onExit }: { slides: StorySlide[]; start: SlidePosition; title: string; onExit: () => void }) {
  const [p, setP] = useState(start)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        setP((q) => advance(slides, q) ?? q)
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setP((q) => goBack(slides, q) ?? q)
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides, onExit])
  const steps = slideSteps(slides[p.index])
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" data-story-test="">
      <div className="flex min-h-0 flex-1 items-center justify-center" onClick={() => setP((q) => advance(slides, q) ?? q)}>
        <ShowStage slides={slides} index={p.index} step={p.step} style={{ width: 'min(100%, calc((100dvh - 44px) * 16 / 9))' }} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-1.5 text-xs text-white">
        <span className="text-[color:var(--gold)]/80">
          teste — só você vê · {title} · slide {p.index + 1}/{slides.length}
          {steps > 0 && ` · clique ${p.step}/${steps}`}
        </span>
        <span className="flex gap-1.5">
          <Button variant="secondary" className="px-2 py-0.5 text-xs" onClick={() => setP((q) => goBack(slides, q) ?? q)}>
            ◀
          </Button>
          <Button variant="primary" className="px-2 py-0.5 text-xs" onClick={() => setP((q) => advance(slides, q) ?? q)} data-test-next="">
            ▶
          </Button>
          <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={onExit}>
            sair do teste
          </Button>
        </span>
      </div>
    </div>
  )
}
