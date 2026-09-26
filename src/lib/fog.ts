import { FOG_COLS } from '../types'
import type { MapFrame, SceneFog, SceneMap } from '../types'
import { remapPoint } from './sceneGeometry'

/**
 * Névoa de guerra.
 *
 * A malha é grossa de propósito: o que dá o acabamento não é a resolução dos
 * dados e sim o desenho, que amplia a malha com interpolação e ainda aplica um
 * borrão. O resultado é uma borda em degradê — o mapa vai sumindo aos poucos em
 * vez de terminar num recorte de tesoura.
 */

export function fogRows(aspect: number): number {
  return Math.max(4, Math.round(FOG_COLS / Math.max(0.1, aspect)))
}

export function emptyFog(aspect: number): SceneFog {
  const rows = fogRows(aspect)
  return { enabled: true, cols: FOG_COLS, rows, cells: '0'.repeat(FOG_COLS * rows) }
}

export function isRevealed(fog: SceneFog, x: number, y: number): boolean {
  const col = Math.min(fog.cols - 1, Math.max(0, Math.floor(x * fog.cols)))
  const row = Math.min(fog.rows - 1, Math.max(0, Math.floor(y * fog.rows)))
  return fog.cells[row * fog.cols + col] === '1'
}

/** Pinta um círculo de células a partir de um ponto do palco (0..1). */
export function paintFog(fog: SceneFog, x: number, y: number, radiusCells: number, reveal: boolean): SceneFog {
  const cx = x * fog.cols
  const cy = y * fog.rows
  // O raio vale em "células de largura"; no eixo Y ele vira outra quantidade de
  // células, porque a célula não é quadrada quando cols/rows não seguem a
  // proporção exata do palco.
  const cells = fog.cells.split('')
  const r2 = radiusCells * radiusCells
  const minRow = Math.max(0, Math.floor(cy - radiusCells - 1))
  const maxRow = Math.min(fog.rows - 1, Math.ceil(cy + radiusCells + 1))
  const minCol = Math.max(0, Math.floor(cx - radiusCells - 1))
  const maxCol = Math.min(fog.cols - 1, Math.ceil(cx + radiusCells + 1))
  const target = reveal ? '1' : '0'
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const dx = col + 0.5 - cx
      const dy = row + 0.5 - cy
      if (dx * dx + dy * dy <= r2) cells[row * fog.cols + col] = target
    }
  }
  return { ...fog, cells: cells.join('') }
}

/** Muda a malha de tamanho mantendo o que já foi explorado (vizinho mais próximo). */
export function resampleFog(fog: SceneFog, cols: number, rows: number): SceneFog {
  if (fog.cols === cols && fog.rows === rows) return fog
  const out: string[] = []
  for (let row = 0; row < rows; row++) {
    const srcRow = Math.min(fog.rows - 1, Math.floor((row / rows) * fog.rows))
    for (let col = 0; col < cols; col++) {
      const srcCol = Math.min(fog.cols - 1, Math.floor((col / cols) * fog.cols))
      out.push(fog.cells[srcRow * fog.cols + srcCol] ?? '0')
    }
  }
  return { ...fog, cols, rows, cells: out.join('') }
}

export function setAll(fog: SceneFog, revealed: boolean): SceneFog {
  return { ...fog, cells: (revealed ? '1' : '0').repeat(fog.cols * fog.rows) }
}

/**
 * Desenha a névoa num canvas do tamanho do palco.
 *
 * O truque do degradê: a malha é desenhada minúscula (uma célula = um pixel) e
 * depois ampliada com suavização, o que já derrete as bordas; o borrão por cima
 * termina o serviço. A área revelada é recortada da escuridão com
 * `destination-out`, então o que sobra é a névoa com buracos de borda macia.
 */
export function drawFog(canvas: HTMLCanvasElement, fog: SceneFog, opts: { alpha: number; softness: number }) {
  const width = canvas.width
  const height = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx || width === 0 || height === 0) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  ctx.fillStyle = `rgba(3, 5, 12, ${opts.alpha})`
  ctx.fillRect(0, 0, width, height)

  const mask = document.createElement('canvas')
  mask.width = fog.cols
  mask.height = fog.rows
  const mctx = mask.getContext('2d')
  if (!mctx) return
  const img = mctx.createImageData(fog.cols, fog.rows)
  for (let i = 0; i < fog.cols * fog.rows; i++) {
    const on = fog.cells[i] === '1' ? 255 : 0
    img.data[i * 4] = 255
    img.data[i * 4 + 1] = 255
    img.data[i * 4 + 2] = 255
    img.data[i * 4 + 3] = on
  }
  mctx.putImageData(img, 0, 0)

  ctx.globalCompositeOperation = 'destination-out'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = `blur(${Math.max(1, (width / fog.cols) * opts.softness).toFixed(1)}px)`
  ctx.drawImage(mask, 0, 0, width, height)

  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Leva a névoa junto quando o Mestre mexe no mapa (gira, desloca, dá zoom).
 *
 * Cada célula da malha nova pergunta: "o terreno que agora está aqui, onde
 * estava antes?" — e copia o que a névoa dizia naquele ponto. O que vem de
 * fora do mapa antigo entra coberto, que é a resposta honesta: o grupo nunca
 * esteve lá.
 */
export function remapFog(fog: SceneFog, from: SceneMap | undefined, to: SceneMap | undefined, aspect: number): SceneFog {
  const out: string[] = []
  for (let row = 0; row < fog.rows; row++) {
    for (let col = 0; col < fog.cols; col++) {
      const before = remapPoint({ x: (col + 0.5) / fog.cols, y: (row + 0.5) / fog.rows }, to, from, aspect)
      if (before.x < 0 || before.x > 1 || before.y < 0 || before.y > 1) {
        out.push('0')
        continue
      }
      out.push(isRevealed(fog, before.x, before.y) ? '1' : '0')
    }
  }
  return { ...fog, cells: out.join('') }
}

/** Só o que move o terreno — o que a âncora da névoa precisa lembrar. */
export function frameOf(map: SceneMap | undefined): MapFrame {
  return { rotation: map?.rotation ?? 0, zoom: map?.zoom ?? 1, offsetX: map?.offsetX ?? 0, offsetY: map?.offsetY ?? 0 }
}

function sameFrame(a: MapFrame, b: MapFrame): boolean {
  const f = frameOf(a)
  const g = frameOf(b)
  return f.rotation === g.rotation && f.zoom === g.zoom && f.offsetX === g.offsetX && f.offsetY === g.offsetY
}

/**
 * A névoa como ela aparece AGORA: a malha guardada levada do enquadramento em
 * que foi pintada até o de agora, na quantidade de linhas da proporção atual
 * do palco. É ela que é desenhada, que esconde as peças e que o pincel pinta.
 */
export function viewFog(fog: SceneFog | undefined, map: MapFrame, aspect: number): SceneFog | undefined {
  if (!fog) return undefined
  const moved = fog.anchor && !sameFrame(fog.anchor, map) ? remapFog(fog, fog.anchor, map, aspect) : fog
  return resampleFog(moved, moved.cols, fogRows(aspect))
}

/** Grava uma névoa já no enquadramento de agora (depois de pintar, revelar tudo...). */
export function anchorFog(fog: SceneFog, map: MapFrame): SceneFog {
  return { ...fog, anchor: frameOf(map) }
}
