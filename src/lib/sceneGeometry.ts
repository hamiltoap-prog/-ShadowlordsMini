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

/** Transformação CSS da imagem do mapa dentro do palco. */
export function mapTransform(map?: SceneMap): string {
  const { rotation = 0, zoom = 1, offsetX = 0, offsetY = 0 } = map ?? {}
  return `translate(${(offsetX * 100).toFixed(3)}%, ${(offsetY * 100).toFixed(3)}%) rotate(${rotation}deg) scale(${zoom})`
}

export const EMPTY_MAP: SceneMap = { rotation: 0, zoom: 1, offsetX: 0, offsetY: 0, fit: 'contain' }
