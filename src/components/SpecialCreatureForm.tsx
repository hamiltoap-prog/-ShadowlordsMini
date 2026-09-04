import { useState } from 'react'
import { newId } from '../lib/id'
import { normalizeImageUrl } from '../lib/imageUrl'
import { CREATURE_SIZES } from '../types'
import type { NPC, NPCAttack, NPCStat, NPCTrait } from '../types'
import { PortraitEditor } from './PortraitEditor'
import { Button, Card, Input, SectionTitle, Select } from './ui'

/** O que a ficha livre devolve — o resto (id, tableId, createdAt) é do chamador. */
export type SpecialCreatureDraft = Pick<
  NPC,
  'name' | 'title' | 'description' | 'defense' | 'hp' | 'attacks' | 'customStats' | 'traits' | 'tokenSize' | 'portraitUrl'
>

function emptyDraft(): SpecialCreatureDraft {
  return {
    name: '',
    title: '',
    description: '',
    defense: 15,
    hp: { current: 60, max: 60 },
    attacks: [{ id: newId(), name: 'Ataque', dano: '2d6', note: '' }],
    customStats: [],
    traits: [],
    tokenSize: 0.17,
    portraitUrl: undefined,
  }
}

/**
 * Ficha livre para criaturas que fogem das regras — um dragão ancião, uma
 * entidade, um titã. Nada aqui é obrigatório além do nome: o Mestre inventa os
 * campos que a criatura pedir.
 */
export function SpecialCreatureForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: NPC
  submitLabel: string
  onSubmit: (draft: SpecialCreatureDraft) => Promise<void> | void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<SpecialCreatureDraft>(() =>
    initial
      ? {
          name: initial.name,
          title: initial.title ?? '',
          description: initial.description ?? '',
          defense: initial.defense,
          hp: initial.hp,
          attacks: initial.attacks.length ? initial.attacks : emptyDraft().attacks,
          customStats: initial.customStats ?? [],
          traits: initial.traits ?? [],
          tokenSize: initial.tokenSize ?? 0.17,
          portraitUrl: initial.portraitUrl,
        }
      : emptyDraft(),
  )
  const [busy, setBusy] = useState(false)

  function patch(next: Partial<SpecialCreatureDraft>) {
    setDraft((d) => ({ ...d, ...next }))
  }

  function updateAttack(id: string, next: Partial<NPCAttack>) {
    patch({ attacks: (draft.attacks ?? []).map((a) => (a.id === id ? { ...a, ...next } : a)) })
  }
  function updateTrait(id: string, next: Partial<NPCTrait>) {
    patch({ traits: (draft.traits ?? []).map((t) => (t.id === id ? { ...t, ...next } : t)) })
  }
  function updateStat(id: string, next: Partial<NPCStat>) {
    patch({ customStats: (draft.customStats ?? []).map((s) => (s.id === id ? { ...s, ...next } : s)) })
  }

  async function submit() {
    if (!draft.name.trim()) return
    setBusy(true)
    try {
      await onSubmit({
        ...draft,
        name: draft.name.trim(),
        title: draft.title?.trim() || undefined,
        description: draft.description?.trim() || undefined,
        portraitUrl: draft.portraitUrl ? normalizeImageUrl(draft.portraitUrl) || undefined : undefined,
        attacks: (draft.attacks ?? [])
          .filter((a) => a.name.trim())
          .map((a) => ({ ...a, name: a.name.trim(), dano: a.dano.trim() || '1d6', note: a.note?.trim() || undefined })),
        traits: (draft.traits ?? []).filter((t) => t.name.trim()).map((t) => ({ ...t, name: t.name.trim(), description: t.description.trim() })),
        customStats: (draft.customStats ?? []).filter((s) => s.label.trim()).map((s) => ({ ...s, label: s.label.trim(), value: s.value.trim() })),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <SectionTitle>{initial ? `Editando ${initial.name}` : 'Nova Criatura Especial'}</SectionTitle>
      <p className="-mt-2 text-xs text-purple-300">
        Ficha livre para o que não cabe no Bestiário nem nas regras de personagem — dragões, entidades, titãs. Só o
        nome é obrigatório.
      </p>

      {/* Identidade */}
      <div className="flex flex-wrap items-start gap-3">
        <PortraitEditor
          url={draft.portraitUrl}
          name={draft.name || '?'}
          size={56}
          onSave={(url) => patch({ portraitUrl: url || undefined })}
        />
        <div className="flex min-w-[16rem] flex-1 flex-col gap-2">
          <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Nome (ex: Bhaligund)" />
          <Input
            value={draft.title ?? ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Título / tipo (ex: Dragão Ancião das Cinzas)"
          />
        </div>
      </div>

      <textarea
        value={draft.description ?? ''}
        onChange={(e) => patch({ description: e.target.value })}
        rows={3}
        placeholder="Descrição, lore, como ela se comporta em cena..."
        className="w-full border border-[color:var(--gold-dark)] bg-[var(--surface-well)] p-2 text-sm text-purple-100 outline-none focus:border-[color:var(--gold)]"
      />

      {/* Números básicos */}
      <div className="flex flex-wrap items-end gap-3 border-t border-[color:var(--gold-dark)] pt-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-purple-300">
          Defesa
          <Input
            type="number"
            value={draft.defense}
            onChange={(e) => patch({ defense: Number(e.target.value) })}
            className="w-24"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-purple-300">
          PV máximo
          <Input
            type="number"
            value={draft.hp.max}
            onChange={(e) => {
              const max = Number(e.target.value)
              patch({ hp: { current: Math.min(draft.hp.current, max), max } })
            }}
            className="w-24"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-purple-300">
          Tamanho no mapa
          <Select
            value={String(draft.tokenSize ?? 0.17)}
            onChange={(e) => patch({ tokenSize: Number(e.target.value) })}
            className="w-40"
          >
            {CREATURE_SIZES.map((s) => (
              <option key={s.key} value={s.size}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {/* Ataques */}
      <div className="flex flex-col gap-2 border-t border-[color:var(--gold-dark)] pt-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Ataques</SectionTitle>
          <Button
            onClick={() => patch({ attacks: [...(draft.attacks ?? []), { id: newId(), name: '', dano: '2d6', note: '' }] })}
          >
            + Ataque
          </Button>
        </div>
        {(draft.attacks ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={a.name}
              onChange={(e) => updateAttack(a.id, { name: e.target.value })}
              placeholder="Nome (ex: Sopro de Cinzas)"
              className="w-52"
            />
            <Input
              value={a.dano}
              onChange={(e) => updateAttack(a.id, { dano: e.target.value })}
              placeholder="Dano (ex: 6d6)"
              className="w-28"
            />
            <Input
              value={a.note ?? ''}
              onChange={(e) => updateAttack(a.id, { note: e.target.value })}
              placeholder="Efeito (ex: incendeia a área)"
              className="w-64"
            />
            <button
              className="text-xs text-red-400 hover:text-red-200"
              onClick={() => patch({ attacks: (draft.attacks ?? []).filter((x) => x.id !== a.id) })}
            >
              remover
            </button>
          </div>
        ))}
      </div>

      {/* Características */}
      <div className="flex flex-col gap-2 border-t border-[color:var(--gold-dark)] pt-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Características</SectionTitle>
          <Button onClick={() => patch({ traits: [...(draft.traits ?? []), { id: newId(), name: '', description: '' }] })}>
            + Característica
          </Button>
        </div>
        {(draft.traits ?? []).length === 0 && (
          <p className="text-xs text-purple-400">Ex: "Voo", "Imune a fogo", "Presença Aterradora".</p>
        )}
        {(draft.traits ?? []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={t.name}
              onChange={(e) => updateTrait(t.id, { name: e.target.value })}
              placeholder="Nome"
              className="w-52"
            />
            <Input
              value={t.description}
              onChange={(e) => updateTrait(t.id, { description: e.target.value })}
              placeholder="O que faz"
              className="w-80"
            />
            <button
              className="text-xs text-red-400 hover:text-red-200"
              onClick={() => patch({ traits: (draft.traits ?? []).filter((x) => x.id !== t.id) })}
            >
              remover
            </button>
          </div>
        ))}
      </div>

      {/* Campos livres */}
      <div className="flex flex-col gap-2 border-t border-[color:var(--gold-dark)] pt-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Outros Campos</SectionTitle>
          <Button onClick={() => patch({ customStats: [...(draft.customStats ?? []), { id: newId(), label: '', value: '' }] })}>
            + Campo
          </Button>
        </div>
        {(draft.customStats ?? []).length === 0 && (
          <p className="text-xs text-purple-400">Ex: "Envergadura" → "12 metros", "Idade" → "900 anos".</p>
        )}
        {(draft.customStats ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={s.label}
              onChange={(e) => updateStat(s.id, { label: e.target.value })}
              placeholder="Rótulo"
              className="w-52"
            />
            <Input
              value={s.value}
              onChange={(e) => updateStat(s.id, { value: e.target.value })}
              placeholder="Valor"
              className="w-64"
            />
            <button
              className="text-xs text-red-400 hover:text-red-200"
              onClick={() => patch({ customStats: (draft.customStats ?? []).filter((x) => x.id !== s.id) })}
            >
              remover
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-[color:var(--gold-dark)] pt-3">
        <Button variant="primary" disabled={!draft.name.trim() || busy} onClick={submit}>
          {busy ? 'Salvando...' : submitLabel}
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  )
}
