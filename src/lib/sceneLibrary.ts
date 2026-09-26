import type { Scene, SceneAudio, SceneLibraryItem, SceneSnapshot } from '../types'

/**
 * A biblioteca de cenas da mesa.
 *
 * Guardar uma cena guarda a cena INTEIRA — imagem, enquadramento, grade, luz,
 * névoa, peças e o som que tocava —, então um encontro preparado antes da
 * sessão volta exatamente como foi montado. Itens antigos, de quando a
 * biblioteca guardava só a imagem, continuam funcionando: trocam só o mapa.
 */

export const NO_FOLDER = '(Sem pasta)'

/** O retrato da cena de agora, pronto para guardar. */
export function snapshotOf(scene: Scene): SceneSnapshot {
  return {
    backgroundUrl: scene.backgroundUrl,
    map: scene.map,
    gridColumns: scene.gridColumns,
    showGrid: scene.showGrid,
    timeOfDay: scene.timeOfDay,
    locationLit: scene.locationLit,
    fog: scene.fog,
    tokens: scene.tokens,
    audio: scene.audio,
  }
}

/** A trilha guardada só volta se havia alguma coisa tocando — senão abrir uma
 *  cena calaria a música que o Mestre acabou de escolher. */
function audioWorthRestoring(audio?: SceneAudio): audio is SceneAudio {
  return Boolean(audio?.ambienceId || audio?.moodId)
}

/**
 * Abre um item da biblioteca por cima da cena atual. O que é da SESSÃO (se a
 * cena está revelada aos jogadores) continua como estava; o que é da CENA volta
 * como foi guardado. `fromLibraryId` lembra de onde a cena veio, para o Mestre
 * poder gravar por cima depois.
 */
export function openLibraryItem(scene: Scene, item: SceneLibraryItem): Scene {
  const s = item.snapshot
  if (!s) return { ...scene, backgroundUrl: item.imageUrl ?? '', fromLibraryId: item.id }
  return {
    ...scene,
    backgroundUrl: s.backgroundUrl,
    map: s.map,
    gridColumns: s.gridColumns,
    showGrid: s.showGrid,
    timeOfDay: s.timeOfDay,
    locationLit: s.locationLit,
    fog: s.fog,
    tokens: s.tokens ?? [],
    audio: audioWorthRestoring(s.audio) ? s.audio : scene.audio,
    fromLibraryId: item.id,
  }
}

/** Mapas e cenas agrupados por pasta, com "sem pasta" por último. */
export function groupByFolder(items: SceneLibraryItem[]): [string, SceneLibraryItem[]][] {
  const groups: Record<string, SceneLibraryItem[]> = {}
  for (const item of items) {
    const key = item.folder?.trim() || NO_FOLDER
    groups[key] = groups[key] ?? []
    groups[key].push(item)
  }
  return Object.entries(groups)
    .map(([k, list]) => [k, [...list].sort((a, b) => a.label.localeCompare(b.label))] as [string, SceneLibraryItem[]])
    .sort(([a], [b]) => (a === NO_FOLDER ? 1 : b === NO_FOLDER ? -1 : a.localeCompare(b)))
}
