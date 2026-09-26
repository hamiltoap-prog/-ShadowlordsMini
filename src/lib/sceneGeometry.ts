import { CREATURE_SIZES, DEFAULT_GRID_COLUMNS, DEFAULT_STAGE_ASPECT } from '../types'
import type { Scene, SceneMap, SceneToken } from '../types'

/**
 * Geometria da tela de jogo.
 *
 * A ideia central: o mapa mora num "palco" de proporção fixa, guardada na cena.
 * As peças são posicionadas em 0..1 desse palco, e não da janela do navegador —
 * por isso a tela do jogador mostra exatamente o mesmo enquadramento e as
 * mesmas posições que a do Mestre, em qualquer tamanho ou formato de tela.
 * Cada um continua com o seu próprio zoom/arraste, que é só a lente por onde
 * olha o mesmo palco.
 */

export const MIN_GRID_COLUMNS = 4
export const MAX_GRID_COLUMNS = 100
export const MIN_MAP_ZOOM = 0.2
export const MAX_MAP_ZOOM = 6

export function stageAspect(scene: Pick<Scene, 'map'>): number {
  const a = scene.map?.aspect
  return a && a > 0.1 && a < 10 ? a : DEFAULT_STAGE_ASPECT
}

export function gridColumns(scene: Pick<Scene, 'gridColumns'>): number {
  const n = scene.gridColumns
  if (!n || !Number.isFinite(n)) return DEFAULT_GRID_COLUMNS
  return Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, Math.round(n)))
}

/** Maior retângulo com a proporção do palco que cabe na janela de cada um. */
export function fitStage(viewportWidth: number, viewportHeight: number, aspect: number) {
  if (viewportWidth <= 0 || viewportHeight <= 0) return { width: 0, height: 0 }
  const width = Math.min(viewportWidth, viewportHeight * aspect)
  return { width, height: width / aspect }
}

/** Quantos quadrados a peça ocupa. Peças antigas (só com `size`) são convertidas. */
export function tokenSquares(token: Pick<SceneToken, 'size' | 'squares'>, columns: number): number {
  if (token.squares && token.squares > 0) return token.squares
  return Math.max(0.5, Math.round(token.size * columns * 2) / 2)
}

/** Diâmetro da peça como fração da largura do palco. */
export function tokenWidth(token: Pick<SceneToken, 'size' | 'squares'>, columns: number): number {
  if (token.squares && token.squares > 0) return Math.min(1, token.squares / columns)
  return token.size
}

/** Converte um tamanho antigo (fração do tabuleiro) no tamanho de criatura mais próximo. */
export function squaresForTokenSize(size?: number): number {
  if (!size) return 1
  let best: { size: number; squares: number } = CREATURE_SIZES[0]
  for (const s of CREATURE_SIZES) {
    if (Math.abs(s.size - size) < Math.abs(best.size - size)) best = s
  }
  return best.squares
}

/**
 * Encaixa a peça na malha: alinha a *caixa* dela aos quadrados, que é o que
 * faz uma criatura de 2 quadrados ocupar dois quadrados inteiros em vez de
 * ficar meio fora. As células são quadradas de verdade — daí o `aspect` entrar
 * na conta do eixo Y, já que 0..1 em Y cobre menos pixels que em X.
 */
export function snapToGrid(
  x: number,
  y: number,
  squares: number,
  columns: number,
  aspect: number,
): { x: number; y: number } {
  const cellX = 1 / columns
  const cellY = aspect / columns
  const halfX = (squares * cellX) / 2
  const halfY = (squares * cellY) / 2
  return {
    x: clamp01(Math.round((x - halfX) / cellX) * cellX + halfX),
    y: clamp01(Math.round((y - halfY) / cellY) * cellY + halfY),
  }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Distância entre dois pontos do palco, em quadrados da grade. */
export function distanceInSquares(
  a: { x: number; y: number },
  b: { x: number; y: number },
  columns: number,
  aspect: number,
): number {
  // As células são quadradas, mas 0..1 em Y cobre menos pixels que em X — daí
  // o `aspect` na conta do eixo vertical.
  const dx = (b.x - a.x) * columns
  const dy = ((b.y - a.y) * columns) / aspect
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Primeira casa livre para uma peça nova, varrendo do canto de cima à
 * esquerda. Sem isso toda peça nascia no centro, uma em cima da outra, e o
 * Mestre precisava separar as peças na mão antes de usar.
 */
export function freeSpot(
  occupied: readonly { x: number; y: number }[],
  squares: number,
  columns: number,
  aspect: number,
): { x: number; y: number } {
  const cellX = 1 / columns
  const cellY = aspect / columns
  for (let row = 0; row * cellY < 1; row++) {
    for (let col = 0; col * cellX < 1; col++) {
      const spot = snapToGrid(col * cellX + (squares * cellX) / 2, row * cellY + (squares * cellY) / 2, squares, columns, aspect)
      const free = occupied.every((t) => Math.abs(t.x - spot.x) > cellX / 2 || Math.abs(t.y - spot.y) > cellY / 2)
      if (free) return spot
    }
  }
  return snapToGrid(0.5, 0.5, squares, columns, aspect)
}

/** Transformação CSS da imagem do mapa dentro do palco. */
export function mapTransform(map?: SceneMap): string {
  const { rotation = 0, zoom = 1, offsetX = 0, offsetY = 0 } = map ?? {}
  return `translate(${(offsetX * 100).toFixed(3)}%, ${(offsetY * 100).toFixed(3)}%) rotate(${rotation}deg) scale(${zoom})`
}

export const EMPTY_MAP: SceneMap = { rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, fit: 'contain' }

/**
 * Até onde o mapa precisa poder escorregar para a borda dele aparecer.
 *
 * O `transform` monta `translate(...) rotate(...) scale(...)`, e nessa ordem o
 * translate é o de FORA: a porcentagem vale sobre o tamanho da imagem antes do
 * zoom. Com zoom 3 a imagem tem 3× a largura do palco, e um controle fixo de
 * ±50% nunca chegava ao fim do mapa. Com zoom `z` sobra `(z − 1) / 2` de
 * imagem para cada lado; girado, o retângulo ocupa mais (`|cos| + |sin|`).
 * Uma folga de 0,15 deixa passar um pouco da borda, e o piso de 0,5 mantém o
 * controle útil com zoom 1 ou menos.
 */
export function mapOffsetLimit(map?: SceneMap): number {
  const { zoom = 1, rotation = 0 } = map ?? {}
  const r = (rotation * Math.PI) / 180
  const box = Math.abs(Math.cos(r)) + Math.abs(Math.sin(r))
  return Math.max(0.5, (zoom * box - 1) / 2 + 0.15)
}

/** Prende o deslocamento ao que o zoom de agora permite — senão, ao diminuir o
 * zoom, ficaria gravado um valor fora do curso, com a imagem fora do palco e
 * o controle já no fim, sem jeito de trazer de volta. */
export function clampMapOffsets(map: SceneMap): SceneMap {
  const limit = mapOffsetLimit(map)
  const clamp = (v: number) => Math.max(-limit, Math.min(limit, v))
  return { ...map, offsetX: clamp(map.offsetX ?? 0), offsetY: clamp(map.offsetY ?? 0) }
}

/* ---------------------------------------------------------------------------
 * Mexer no mapa sem descolar a névoa e as peças.
 *
 * O `transform` do CSS move só a imagem: a névoa pintada e as peças ficariam
 * paradas, com o terreno escorregando por baixo. Então a mesma mudança é
 * aplicada a elas — um ponto que estava em `p` com o mapa em `from` passa a
 * estar em `to(from⁻¹(p))`. As contas acontecem num espaço quadrado (Y
 * dividido pela proporção), senão o giro sairia oval.
 * ------------------------------------------------------------------------- */

type Pt = { x: number; y: number }

/** Onde um ponto da imagem vai parar no palco depois do transform do mapa. */
export function applyMapTransform(map: SceneMap | undefined, p: Pt, aspect: number): Pt {
  const { rotation = 0, zoom = 1, offsetX = 0, offsetY = 0 } = map ?? {}
  const cx = 0.5
  const cy = 0.5 / aspect
  const dx = p.x - cx
  const dy = p.y / aspect - cy
  const th = (rotation * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  // A ordem do CSS (translate rotate scale) chega no ponto de trás para a
  // frente: escala, depois gira, depois desloca.
  const sx = dx * zoom
  const sy = dy * zoom
  return {
    x: cx + (sx * cos - sy * sin) + offsetX,
    y: (cy + (sx * sin + sy * cos) + offsetY / aspect) * aspect,
  }
}

/** O caminho de volta: de onde o ponto veio, antes do transform. */
export function invertMapTransform(map: SceneMap | undefined, p: Pt, aspect: number): Pt {
  const { rotation = 0, zoom = 1, offsetX = 0, offsetY = 0 } = map ?? {}
  const cx = 0.5
  const cy = 0.5 / aspect
  const safeZoom = Math.abs(zoom) < 1e-6 ? 1 : zoom
  const dx = p.x - cx - offsetX
  const dy = p.y / aspect - cy - offsetY / aspect
  const th = (-rotation * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const rx = dx * cos - dy * sin
  const ry = dx * sin + dy * cos
  return { x: cx + rx / safeZoom, y: (cy + ry / safeZoom) * aspect }
}

/** Para onde o terreno que estava em `p` foi, ao mapa sair de `from` para `to`. */
export function remapPoint(p: Pt, from: SceneMap | undefined, to: SceneMap | undefined, aspect: number): Pt {
  return applyMapTransform(to, invertMapTransform(from, p, aspect), aspect)
}

/** As peças acompanham o terreno em que estavam. As da bandeja não se mexem. */
export function remapTokens(
  tokens: SceneToken[],
  from: SceneMap | undefined,
  to: SceneMap | undefined,
  aspect: number,
): SceneToken[] {
  return tokens.map((t) => {
    if (t.onBoard === false) return t
    const q = remapPoint({ x: t.x, y: t.y }, from, to, aspect)
    return { ...t, x: clamp01(q.x), y: clamp01(q.y) }
  })
}
