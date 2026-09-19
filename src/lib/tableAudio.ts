import { DEFAULT_AUDIO_VOLUME } from '../types'
import type { AudioTrack, GameTable, Scene } from '../types'

/**
 * Decide o que cada tela de jogo deve estar tocando.
 *
 * A regra do combate é a única que atropela as outras: enquanto ele dura, a
 * música de combate (ou a de chefe) fica sozinha no ar e as demais saem. Ao
 * terminar, esta função volta a apontar para o que o Mestre tinha escolhido —
 * é por isso que o "voltar ao que estava tocando" não precisa de memória: a
 * escolha do Mestre nunca foi apagada, só ficou em silêncio.
 */
export interface AudioPlan {
  ambience: AudioTrack | null
  mood: AudioTrack | null
  combat: AudioTrack | null
  /** O combate assumiu a trilha: ambientação e clima saem em fade out. */
  combatTakeover: boolean
}

export interface AudioVolumes {
  ambience: number
  mood: number
  combat: number
}

function byId(tracks: AudioTrack[], id?: string): AudioTrack | null {
  if (!id) return null
  return tracks.find((t) => t.id === id) ?? null
}

export function resolveAudioPlan(
  table: Pick<GameTable, 'combatActive' | 'combatKind'> | null | undefined,
  scene: Pick<Scene, 'audio'> | null | undefined,
  tracks: AudioTrack[],
): AudioPlan {
  const boss = tracks.find((t) => t.kind === 'boss') ?? null
  const normal = tracks.find((t) => t.kind === 'combat') ?? null
  // Numa batalha de chefe sem música própria, a de combate normal serve.
  const combatTrack = table?.combatKind === 'boss' ? (boss ?? normal) : normal

  if (table?.combatActive && combatTrack) {
    return { ambience: null, mood: null, combat: combatTrack, combatTakeover: true }
  }
  return {
    ambience: byId(tracks, scene?.audio?.ambienceId),
    mood: byId(tracks, scene?.audio?.moodId),
    combat: null,
    combatTakeover: false,
  }
}

export function resolveVolumes(scene: Pick<Scene, 'audio'> | null | undefined): AudioVolumes {
  const a = scene?.audio
  const clamp = (v: number | undefined) => Math.min(1, Math.max(0, v ?? DEFAULT_AUDIO_VOLUME))
  return { ambience: clamp(a?.ambienceVolume), mood: clamp(a?.moodVolume), combat: clamp(a?.combatVolume) }
}
