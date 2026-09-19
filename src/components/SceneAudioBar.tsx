import { AUDIO_KIND_LABELS, DEFAULT_AUDIO_VOLUME } from '../types'
import type { AudioTrack, Scene, SceneAudio } from '../types'
import type { AudioPlan, AudioVolumes } from '../lib/tableAudio'
import type { AudioStatus } from './TableAudio'
import { Badge, Button, Select } from './ui'

/**
 * Controle rápido do som na tela de jogo.
 *
 * Todo mundo vê o botão de liberar o áudio (sem um gesto, o navegador não
 * deixa tocar) e o que está no ar; só o Mestre escolhe as faixas e mexe nos
 * volumes. Ambientação e clima são uma de cada — escolher outra troca a que
 * estava, que é exatamente o comportamento pedido.
 */
export function SceneAudioBar({
  isGM,
  tracks,
  scene,
  plan,
  volumes,
  enabled,
  statuses,
  onEnable,
  onDisable,
  onPatchAudio,
}: {
  isGM: boolean
  tracks: AudioTrack[]
  scene: Scene
  plan: AudioPlan
  volumes: AudioVolumes
  enabled: boolean
  /** Como cada canal está agora — para um erro aparecer em vez de silêncio. */
  statuses: Record<string, AudioStatus>
  onEnable: () => void
  onDisable: () => void
  onPatchAudio: (patch: Partial<SceneAudio>) => void
}) {
  const ambienceOptions = tracks.filter((t) => t.kind === 'ambience')
  const moodOptions = tracks.filter((t) => t.kind === 'mood')
  const hasAnything = tracks.length > 0

  if (!hasAnything && !isGM) return null

  const nowPlaying = [plan.combat?.label, plan.ambience?.label, plan.mood?.label].filter(Boolean).join(' + ')
  // Um canal que falhou precisa dizer o que houve: silêncio sem explicação foi
  // o que mais atrapalhou nos primeiros testes.
  const problems = Object.entries(statuses)
    .filter(([, s]) => s.state === 'error' && s.message)
    .map(([, s]) => s.message as string)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-purple-400/60">Som</span>

      {enabled ? (
        <Button className="text-xs" onClick={onDisable} title="Silenciar só na sua tela">
          🔇 Silenciar aqui
        </Button>
      ) : (
        <Button variant="primary" className="text-xs" onClick={onEnable} title="O navegador exige um clique para liberar o áudio">
          🔊 Ligar o som
        </Button>
      )}

      {plan.combatTakeover && <Badge tone="bad">⚔️ trilha de combate</Badge>}
      {enabled && nowPlaying && problems.length === 0 && (
        <span className="text-xs text-purple-300/60">tocando: {nowPlaying}</span>
      )}
      {enabled &&
        problems.map((p, i) => (
          <span key={i} className="text-xs text-red-300">
            ⚠ {p}
          </span>
        ))}
      {!hasAnything && isGM && (
        <span className="text-xs text-purple-400/50">Nenhuma faixa ainda — monte a Mesa de Som no painel.</span>
      )}

      {isGM && hasAnything && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-purple-200">
            {AUDIO_KIND_LABELS.ambience}
            <Select
              value={scene.audio?.ambienceId ?? ''}
              onChange={(e) => onPatchAudio({ ambienceId: e.target.value || undefined })}
              className="w-auto min-w-[8rem] text-xs"
            >
              <option value="">— silêncio —</option>
              {ambienceOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-purple-200">
            {AUDIO_KIND_LABELS.mood}
            <Select
              value={scene.audio?.moodId ?? ''}
              onChange={(e) => onPatchAudio({ moodId: e.target.value || undefined })}
              className="w-auto min-w-[8rem] text-xs"
            >
              <option value="">— silêncio —</option>
              {moodOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </label>

          <VolumeSlider
            label="amb."
            value={volumes.ambience}
            onChange={(v) => onPatchAudio({ ambienceVolume: v })}
          />
          <VolumeSlider label="clima" value={volumes.mood} onChange={(v) => onPatchAudio({ moodVolume: v })} />
          <VolumeSlider label="combate" value={volumes.combat} onChange={(v) => onPatchAudio({ combatVolume: v })} />
        </>
      )}
    </div>
  )
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-purple-300/70" title={`Volume de ${label}`}>
      {label}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round((value ?? DEFAULT_AUDIO_VOLUME) * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-20"
        data-volume={label}
      />
    </label>
  )
}
