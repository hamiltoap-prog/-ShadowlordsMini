// Checagens das regras dos slides. Rode com `npm run check`.
import type { SlideElemento, StorySlide } from '../types'
import {
  advance,
  duplicateSlide,
  goBack,
  keepOnStage,
  moveLayer,
  newShape,
  newText,
  normalizeSlide,
  slideSteps,
  slidesForShow,
  snapToStage,
  storyCover,
} from './slides'

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}: esperado ${e}, veio ${a}`)
}

const t = (id: string, passo?: number): SlideElemento => ({ ...newText(), id, passo })

// Dois slides: o primeiro com dois cliques, o segundo sem nenhum.
const slides: StorySlide[] = [
  { id: 's1', elementos: [t('a'), t('b', 1), t('c', 2)] },
  { id: 's2', elementos: [t('d')] },
]
eq(slideSteps(slides[0]), 2, 'cliques do slide')

// O caminho do "próximo": 0.0 → 0.1 → 0.2 → 1.0 → fim.
let p = { index: 0, step: 0 }
const path: string[] = []
for (let i = 0; i < 5; i++) {
  path.push(`${p.index}.${p.step}`)
  const next = advance(slides, p)
  if (!next) break
  p = next
}
eq(path, ['0.0', '0.1', '0.2', '1.0'], 'caminho do próximo')
eq(advance(slides, { index: 1, step: 0 }), null, 'no fim fica onde está')

// Voltar: desfaz um clique; do começo de um slide, volta ao anterior COMPLETO.
eq(goBack(slides, { index: 0, step: 2 }), { index: 0, step: 1 }, 'desfaz um clique')
eq(goBack(slides, { index: 1, step: 0 }), { index: 0, step: 2 }, 'volta ao anterior já completo')
eq(goBack(slides, { index: 0, step: 0 }), null, 'no começo não volta')

// Camadas: a ordem do array é a ordem de empilhamento.
const layers = [t('x'), t('y'), t('z')]
eq(moveLayer(layers, 'x', 'frente').map((e) => e.id), ['y', 'z', 'x'], 'trazer para a frente')
eq(moveLayer(layers, 'z', 'tras').map((e) => e.id), ['z', 'x', 'y'], 'enviar para trás')
eq(moveLayer(layers, 'x', 'subir').map((e) => e.id), ['y', 'x', 'z'], 'subir um nível')
eq(moveLayer(layers, 'x', 'descer').map((e) => e.id), ['x', 'y', 'z'], 'descer no fundo não sai do lugar')

// Ímã: encosta o centro no centro do palco, e devolve a guia.
const snapped = snapToStage({ x: 0.255, y: 0.1, w: 0.5, h: 0.2 })
eq([Number(snapped.x.toFixed(4)), snapped.guidesX], [0.25, [0.5]], 'ímã no centro')

// Preso ao palco: pode sangrar a borda, mas não some nem fica minúsculo.
const kept = keepOnStage({ ...newShape(), x: 5, y: -5, w: 0.001, h: 0.5 })
eq([kept.x, kept.y, kept.w], [0.98, -0.48, 0.02], 'preso ao palco')

// Formato antigo vira camadas com a mesma cara.
const old = normalizeSlide({ id: 'v', title: 'O Cerco', text: 'A muralha cai.', imageUrl: 'https://x/y.png', notas: 'lembrar do traidor' })
eq(old.fundoUrl, 'https://x/y.png', 'imagem antiga vira fundo')
eq((old.elementos ?? []).map((e) => e.nome), ['faixa', 'título', 'texto'], 'faixa + título + texto')
const fresh: StorySlide = { id: 'n', elementos: [] }
eq(normalizeSlide(fresh) === fresh, true, 'slide novo passa direto')

// As notas do Mestre NUNCA vão para a tela dos jogadores.
const shown = slidesForShow([{ ...slides[0], notas: 'o vilão é o irmão' }, old])
eq(shown.some((s) => 'notas' in s), false, 'notas fora da apresentação')
eq(JSON.stringify(shown).includes('irmão') || JSON.stringify(shown).includes('traidor'), false, 'nenhum texto das notas no ar')

// Duplicar dá ids novos a tudo.
const dup = duplicateSlide(slides[0])
eq(dup.id !== 's1' && (dup.elementos ?? []).every((e) => !['a', 'b', 'c'].includes(e.id)), true, 'duplicar troca os ids')

// Capa: a primeira imagem da história.
eq(storyCover([fresh, old]), 'https://x/y.png', 'capa da história')
