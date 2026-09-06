import { useEffect, useState } from 'react'
import { logNote } from '../lib/actions'
import { newId } from '../lib/id'
import { RARITY_STYLE, customItemToEntry, effectDetails, toCarriedArmor, toCarriedWeapon, toInventoryItem } from '../lib/items'
import { totalDefense } from '../lib/characterMath'
import { deleteCustomItem, listenCustomItems, saveCustomItem, updateCharacter } from '../lib/store'
import {
  CUSTOM_ITEM_KIND_LABELS,
  DAMAGE_TYPES,
  EFFECT_TRIGGERS,
  EFFECT_TRIGGER_LABELS,
  ITEM_RARITIES,
  RARITY_LABELS,
  WEAPON_SKILLS,
} from '../types'
import type {
  Character,
  CustomItem,
  CustomItemKind,
  DamageType,
  EffectTrigger,
  GameTable,
  ItemEffect,
  ItemRarity,
} from '../types'
import { Badge, Button, Card, Input, SectionTitle, Select, TabButton } from './ui'

/**
 * Forja de itens do Mestre: armas, armaduras e equipamentos próprios da
 * campanha, mágicos ou não, com tipo de dano, bônus e efeitos. O item vai para
 * o catálogo da mesa e de lá pode entrar na loja, ser entregue direto a um
 * personagem, ou os dois.
 */

function emptyItem(tableId: string, kind: CustomItemKind): CustomItem {
  return {
    id: newId(),
    tableId,
    kind,
    name: '',
    rarity: 'comum',
    magical: false,
    custo: 0,
    inShop: true,
    createdAt: Date.now(),
    dano: kind === 'weapon' ? '1d6' : undefined,
    habilidade: kind === 'weapon' ? 'Combate' : undefined,
    damageTypes: kind === 'weapon' ? ['Cortante'] : undefined,
    defesaBonus: kind === 'armor' ? 1 : undefined,
    effects: [],
  }
}

export function ItemForge({ table, characters }: { table: GameTable; characters: Character[] }) {
  const [items, setItems] = useState<CustomItem[]>([])
  const [draft, setDraft] = useState<CustomItem | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => listenCustomItems(table.id, setItems), [table.id])

  const actor = { tableId: table.id, actorName: 'Mestre', actorType: 'gm' as const }

  async function save() {
    if (!draft || !draft.name.trim()) return
    await saveCustomItem(table.id, { ...draft, name: draft.name.trim() })
    setDraft(null)
    setFeedback('Item guardado no catálogo da mesa.')
    setTimeout(() => setFeedback(''), 2500)
  }

  /** Entrega o item direto na ficha, sem passar pela loja nem custar moedas. */
  async function give(item: CustomItem, characterId: string) {
    const c = characters.find((x) => x.id === characterId)
    if (!c) return
    const entry = customItemToEntry(item)
    if (item.kind === 'weapon') {
      await updateCharacter(table.id, c.id, { weapons: [...c.weapons, toCarriedWeapon(entry)] })
    } else if (item.kind === 'armor') {
      const armor = [...c.armor, toCarriedArmor(entry)]
      await updateCharacter(table.id, c.id, { armor, defense: totalDefense(c.baseDefense, armor) })
    } else {
      const existing = c.equipment.find((i) => i.name === item.name)
      const equipment = existing
        ? c.equipment.map((i) => (i.name === item.name ? { ...i, qty: i.qty + 1 } : i))
        : [...c.equipment, toInventoryItem(entry)]
      await updateCharacter(table.id, c.id, { equipment })
    }
    await logNote(actor, `entregou ${item.icon ? item.icon + ' ' : ''}${item.name} para ${c.name}`, 'table')
    setFeedback(`${item.name} entregue a ${c.name}.`)
    setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>🔨 Forja de Itens</SectionTitle>
        {!draft && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CUSTOM_ITEM_KIND_LABELS) as CustomItemKind[]).map((k) => (
              <Button key={k} variant="primary" className="text-xs" onClick={() => setDraft(emptyItem(table.id, k))}>
                + {CUSTOM_ITEM_KIND_LABELS[k]}
              </Button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-purple-300/50">
        Crie armas, armaduras e equipamentos próprios da sua campanha. Eles ficam salvos nesta mesa, aparecem na loja
        quando ela abrir (se você marcar) e podem ser entregues direto na ficha de alguém — para um tesouro, por exemplo.
      </p>

      {draft && <ItemForm draft={draft} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} />}

      {feedback && <p className="text-xs text-emerald-300">{feedback}</p>}

      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            characters={characters}
            onEdit={() => setDraft(item)}
            onGive={(cid) => give(item, cid)}
            onDelete={() => deleteCustomItem(table.id, item.id)}
            onToggleShop={() => saveCustomItem(table.id, { ...item, inShop: !item.inShop })}
          />
        ))}
        {items.length === 0 && !draft && (
          <p className="text-xs text-purple-400/40">Nenhum item forjado ainda.</p>
        )}
      </div>
    </Card>
  )
}

function ItemRow({
  item,
  characters,
  onEdit,
  onGive,
  onDelete,
  onToggleShop,
}: {
  item: CustomItem
  characters: Character[]
  onEdit: () => void
  onGive: (characterId: string) => void
  onDelete: () => void
  onToggleShop: () => void
}) {
  const [target, setTarget] = useState('')
  const entry = customItemToEntry(item)
  const details = effectDetails(item.effects)

  return (
    <div data-item={item.name} className="flex flex-col gap-1.5 rounded-lg border border-purple-900/40 bg-black/20 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">{item.icon || (item.kind === 'weapon' ? '⚔️' : item.kind === 'armor' ? '🛡️' : '🎒')}</span>
        <span className={`text-sm font-semibold ${RARITY_STYLE[item.rarity]}`}>{item.name}</span>
        {item.magical && <Badge tone="good">mágico</Badge>}
        <Badge>{RARITY_LABELS[item.rarity]}</Badge>
        <Badge>{CUSTOM_ITEM_KIND_LABELS[item.kind]}</Badge>
        {entry.extra && <span className="text-xs text-purple-300/70">{entry.extra}</span>}
        <span className="text-xs text-[color:var(--gold)]">💰 {item.custo}</span>
        <label className="flex items-center gap-1 text-xs text-purple-300/70">
          <input type="checkbox" checked={item.inShop} onChange={onToggleShop} />
          na loja
        </label>
      </div>

      {item.description && <p className="text-xs text-purple-300/60">{item.description}</p>}
      {entry.note && !item.description && <p className="text-xs text-purple-300/50">{entry.note}</p>}
      {details && <p className="text-xs text-[color:var(--gold)]/80">✦ {details}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="w-auto text-xs">
          <option value="">Entregar a...</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button
          className="text-xs"
          disabled={!target}
          onClick={() => {
            onGive(target)
            setTarget('')
          }}
        >
          Entregar
        </Button>
        <button className="text-xs text-purple-400 hover:text-purple-100" onClick={onEdit}>
          editar
        </button>
        <button className="text-xs text-red-400 hover:text-red-200" onClick={onDelete}>
          apagar
        </button>
      </div>
    </div>
  )
}

function ItemForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CustomItem
  onChange: (next: CustomItem) => void
  onSave: () => void
  onCancel: () => void
}) {
  const patch = (p: Partial<CustomItem>) => onChange({ ...draft, ...p })

  function toggleDamageType(t: DamageType) {
    const current = draft.damageTypes ?? []
    patch({ damageTypes: current.includes(t) ? current.filter((x) => x !== t) : [...current, t] })
  }

  function patchEffect(id: string, p: Partial<ItemEffect>) {
    patch({ effects: (draft.effects ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)) })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--gold-dark)] bg-[var(--surface-well)] p-3">
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(CUSTOM_ITEM_KIND_LABELS) as CustomItemKind[]).map((k) => (
          <TabButton key={k} active={draft.kind === k} onClick={() => patch({ kind: k })}>
            {CUSTOM_ITEM_KIND_LABELS[k]}
          </TabButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Nome do item"
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="min-w-[14rem] flex-1"
        />
        <Input
          placeholder="🗡️"
          title="Um emoji para reconhecer o item de relance"
          value={draft.icon ?? ''}
          onChange={(e) => patch({ icon: e.target.value.slice(0, 4) })}
          style={{ width: '4rem' }}
        />
        <Select
          value={draft.rarity}
          onChange={(e) => patch({ rarity: e.target.value as ItemRarity })}
          className="w-auto"
        >
          {ITEM_RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-purple-200">
          💰
          <Input
            type="number"
            min={0}
            value={draft.custo}
            onChange={(e) => patch({ custo: Math.max(0, Number(e.target.value)) })}
            style={{ width: '5.5rem' }}
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-purple-200">
          <input type="checkbox" checked={draft.inShop} onChange={(e) => patch({ inShop: e.target.checked })} />
          Vender na loja
        </label>
      </div>

      <textarea
        value={draft.description ?? ''}
        onChange={(e) => patch({ description: e.target.value })}
        rows={2}
        placeholder="Descrição — de onde veio, como é, o que se conta sobre ele..."
        className="w-full border border-[color:var(--gold-dark)] bg-black/20 p-2 text-sm text-purple-50 outline-none focus:border-[color:var(--gold)]"
      />

      {draft.kind === 'weapon' && (
        <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-purple-200">
            <label className="flex items-center gap-1.5">
              Dano
              <Input
                value={draft.dano ?? ''}
                onChange={(e) => patch({ dano: e.target.value })}
                placeholder="2d6"
                style={{ width: '5.5rem' }}
              />
            </label>
            <label className="flex items-center gap-1.5">
              Habilidade
              <Select
                value={draft.habilidade ?? 'Combate'}
                onChange={(e) => patch({ habilidade: e.target.value })}
                className="w-auto"
              >
                {WEAPON_SKILLS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-1.5">
              Alcance
              <Input
                value={draft.alcance ?? ''}
                onChange={(e) => patch({ alcance: e.target.value })}
                placeholder="corpo a corpo, 20 m..."
                className="w-44"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-purple-400/60">Tipo de dano</span>
            {DAMAGE_TYPES.map((t) => {
              const on = (draft.damageTypes ?? []).includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleDamageType(t)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    on
                      ? 'border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold-bright)]'
                      : 'border-purple-800/50 text-purple-300/70 hover:border-purple-500'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {draft.kind === 'armor' && (
        <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2">
          <label className="flex items-center gap-1.5 text-sm text-purple-200">
            Bônus de Defesa
            <Input
              type="number"
              min={0}
              max={10}
              value={draft.defesaBonus ?? 0}
              onChange={(e) => patch({ defesaBonus: Math.max(0, Number(e.target.value)) })}
              style={{ width: '5rem' }}
            />
          </label>
          <textarea
            value={draft.protecao ?? ''}
            onChange={(e) => patch({ protecao: e.target.value })}
            rows={2}
            placeholder="Proteção — ex: Reduz Dano Cortante em até 1d6 por até 1d3+3 vezes"
            className="w-full border border-[color:var(--gold-dark)] bg-black/20 p-2 text-sm text-purple-50 outline-none focus:border-[color:var(--gold)]"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2">
        <label className="flex items-center gap-2 text-sm text-purple-100">
          <input type="checkbox" checked={draft.magical} onChange={(e) => patch({ magical: e.target.checked })} />
          ✦ Item mágico
        </label>
        {draft.magical && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-purple-200">
            {draft.kind === 'weapon' && (
              <>
                <label className="flex items-center gap-1.5">
                  Bônus de ataque
                  <Input
                    type="number"
                    value={draft.attackBonus ?? 0}
                    onChange={(e) => patch({ attackBonus: Number(e.target.value) })}
                    style={{ width: '5rem' }}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  Bônus de dano
                  <Input
                    type="number"
                    value={draft.damageBonus ?? 0}
                    onChange={(e) => patch({ damageBonus: Number(e.target.value) })}
                    style={{ width: '5rem' }}
                  />
                </label>
              </>
            )}
            <label className="flex items-center gap-1.5">
              Cargas
              <Input
                type="number"
                min={0}
                value={draft.charges ?? 0}
                onChange={(e) => patch({ charges: Math.max(0, Number(e.target.value)) })}
                style={{ width: '5rem' }}
              />
              <span className="text-xs text-purple-400/50">(0 = sem limite)</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.14em] text-purple-400/60">Efeitos</span>
          <Button
            className="text-xs"
            onClick={() =>
              patch({
                effects: [
                  ...(draft.effects ?? []),
                  { id: newId(), name: '', description: '', trigger: 'acerto', chance: '' },
                ],
              })
            }
          >
            + Efeito
          </Button>
        </div>
        {(draft.effects ?? []).map((e) => (
          <div key={e.id} className="flex flex-col gap-1.5 rounded border border-purple-900/40 bg-black/20 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Nome do efeito — ex: Queimadura"
                value={e.name}
                onChange={(ev) => patchEffect(e.id, { name: ev.target.value })}
                className="min-w-[12rem] flex-1"
              />
              <Select
                value={e.trigger}
                onChange={(ev) => patchEffect(e.id, { trigger: ev.target.value as EffectTrigger })}
                className="w-auto"
              >
                {EFFECT_TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {EFFECT_TRIGGER_LABELS[t]}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Chance (ex: 1-2 em 1d6)"
                value={e.chance ?? ''}
                onChange={(ev) => patchEffect(e.id, { chance: ev.target.value })}
                className="w-44"
              />
              <button
                className="text-xs text-red-400 hover:text-red-200"
                onClick={() => patch({ effects: (draft.effects ?? []).filter((x) => x.id !== e.id) })}
              >
                remover
              </button>
            </div>
            <Input
              placeholder="O que acontece — ex: o alvo sofre 1d6 de dano por 3 rodadas"
              value={e.description}
              onChange={(ev) => patchEffect(e.id, { description: ev.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-purple-900/30 pt-2">
        <Button variant="primary" disabled={!draft.name.trim()} onClick={onSave}>
          Guardar item
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}
