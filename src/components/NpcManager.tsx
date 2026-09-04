import { useEffect, useState } from 'react'
import { BESTIARY, BESTIARY_CATEGORIES } from '../data/bestiary'
import { roll, roll3d6 } from '../lib/dice'
import { newId } from '../lib/id'
import { addLogEntry, createNPC, deleteNPC, listenMonsterImages, setMonsterImage, updateCharacter, updateNPC } from '../lib/store'
import type { Character, GameTable, NPC } from '../types'
import { PortraitEditor } from './PortraitEditor'
import { SpecialCreatureForm } from './SpecialCreatureForm'
import { Badge, Button, Card, Input, Select, SectionTitle } from './ui'

export function NpcManager({ table, npcs, characters }: { table: GameTable; npcs: NPC[]; characters: Character[] }) {
  const [category, setCategory] = useState(BESTIARY_CATEGORIES[0])
  const [bestiaryChoice, setBestiaryChoice] = useState(BESTIARY.find((b) => b.category === BESTIARY_CATEGORIES[0])?.name ?? '')
  const [customName, setCustomName] = useState('')
  const [creatingSpecial, setCreatingSpecial] = useState(false)
  const [monsterImages, setMonsterImages] = useState<Record<string, string>>({})

  useEffect(() => listenMonsterImages(table.id, setMonsterImages), [table.id])

  const categoryOptions = BESTIARY.filter((b) => b.category === category)
  const defaultImageUrl = monsterImages[bestiaryChoice.trim().toLowerCase()]

  async function addFromBestiary() {
    const entry = BESTIARY.find((b) => b.name === bestiaryChoice)
    if (!entry) return
    await createNPC(table.id, {
      tableId: table.id,
      name: entry.name,
      defense: entry.defense,
      hp: { current: entry.hp, max: entry.hp },
      attacks: entry.attacks.map((a) => ({ id: newId(), name: a.name, dano: a.dano, note: a.note })),
      sourceLabel: `${entry.category}${entry.special ? ' — ' + entry.special : ''}`,
      portraitUrl: monsterImages[entry.name.trim().toLowerCase()],
      visible: false,
      createdAt: Date.now(),
    })
  }

  async function addCustom() {
    if (!customName.trim()) return
    await createNPC(table.id, {
      tableId: table.id,
      name: customName.trim(),
      defense: 12,
      hp: { current: 10, max: 10 },
      attacks: [{ id: newId(), name: 'Ataque', dano: '1d6' }],
      sourceLabel: 'Personalizado',
      portraitUrl: monsterImages[customName.trim().toLowerCase()],
      visible: false,
      createdAt: Date.now(),
    })
    setCustomName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>👹 Outras Criaturas Personalizadas</SectionTitle>
        <p className="mt-0.5 text-xs text-purple-300/50">
          Fichas resumidas (PV, Defesa, ataques) do bestiário ou criadas na hora — para NPCs com ficha completa,
          veja a seção NPCs acima.
        </p>
      </div>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              const first = BESTIARY.find((b) => b.category === e.target.value)
              setBestiaryChoice(first?.name ?? '')
            }}
            className="w-auto"
          >
            {BESTIARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={bestiaryChoice} onChange={(e) => setBestiaryChoice(e.target.value)} className="w-auto min-w-[10rem]">
            {categoryOptions.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name} (Def {b.defense}, PV {b.hp})
              </option>
            ))}
          </Select>
          <PortraitEditor
            url={defaultImageUrl}
            name={bestiaryChoice || '?'}
            size={32}
            onSave={(url) => setMonsterImage(table.id, bestiaryChoice, url)}
          />
          <Button variant="primary" onClick={addFromBestiary}>
            Adicionar do Bestiário
          </Button>
        </div>
        <p className="text-[11px] text-purple-400/50">
          A foto ao lado é a imagem padrão deste monstro — troque uma vez e toda futura adição já vem com ela.
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-purple-900/30 pt-2">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nome da criatura personalizada"
            className="w-56"
          />
          <Button onClick={addCustom}>Adicionar Personalizada</Button>
          <span className="mx-1 h-5 w-px bg-[color:var(--gold-dark)]" />
          <Button variant="primary" onClick={() => setCreatingSpecial(true)}>
            ✦ Criatura Especial (ficha livre)
          </Button>
        </div>
        <p className="text-[11px] text-purple-400/50">
          Ficha livre é para o que foge das regras — dragões, entidades, titãs: você inventa os campos.
        </p>
      </Card>

      {creatingSpecial && (
        <SpecialCreatureForm
          submitLabel="Criar criatura"
          onCancel={() => setCreatingSpecial(false)}
          onSubmit={async (draft) => {
            await createNPC(table.id, {
              tableId: table.id,
              flavor: 'special',
              sourceLabel: draft.title || 'Criatura especial',
              visible: false,
              createdAt: Date.now(),
              ...draft,
              // Criatura nova entra em cena com os PV cheios.
              hp: { current: draft.hp.max, max: draft.hp.max },
            })
            setCreatingSpecial(false)
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {npcs.map((npc) => (
          <NpcCard key={npc.id} table={table} npc={npc} characters={characters} />
        ))}
        {npcs.length === 0 && <p className="text-sm text-purple-300/50">Nenhuma criatura personalizada nesta mesa ainda.</p>}
      </div>
    </div>
  )
}

function NpcCard({ table, npc, characters }: { table: GameTable; npc: NPC; characters: Character[] }) {
  const [hpDelta, setHpDelta] = useState(1)
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '')
  const [attackIdx, setAttackIdx] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [editing, setEditing] = useState(false)

  const target = characters.find((c) => c.id === targetId)
  const attack = npc.attacks[attackIdx]

  async function applyHp(delta: number) {
    const newCurrent = Math.max(0, Math.min(npc.hp.max, npc.hp.current + delta))
    await updateNPC(table.id, npc.id, { hp: { ...npc.hp, current: newCurrent } })
  }

  async function savePortrait(url: string) {
    await updateNPC(table.id, npc.id, { portraitUrl: url || undefined })
    if (url.trim()) await setMonsterImage(table.id, npc.name, url.trim())
  }

  async function rollAttack() {
    if (!target || !attack) return
    const r = roll3d6()
    const total = r.total + bonus
    const success = total >= target.defense
    let summary = `${npc.name} ataca ${target.name} com ${attack.name}: 3d6 [${r.rolls.join(', ')}] ${bonus ? (bonus >= 0 ? '+' : '') + bonus : ''} = ${total} vs Defesa ${target.defense} → ${success ? 'Sucesso' : 'Fracasso'}`

    // Acerto: já rola o dano e aplica no alvo, narrando tudo numa só mensagem.
    if (success) {
      const d = roll(attack.dano)
      const dmgTotal = Math.max(1, d.total)
      summary += ` — causou ${dmgTotal} de dano${attack.note ? ` — ${attack.note}` : ''}`
      const newCurrent = Math.max(0, target.hp.current - dmgTotal)
      await updateCharacter(table.id, target.id, { hp: { ...target.hp, current: newCurrent }, isAlive: newCurrent > 0 })
    }

    await addLogEntry(table.id, {
      actorName: npc.name,
      actorType: 'gm',
      kind: 'attack',
      summary,
      rolls: r.rolls,
      total,
      success,
      dice: r.rolls,
      diceLabel: `${npc.name} · ${attack.name}`,
    })
  }

  async function rollDamageOnTarget() {
    if (!attack) return
    const d = roll(attack.dano)
    const total = Math.max(1, d.total)
    await addLogEntry(table.id, {
      actorName: npc.name,
      actorType: 'gm',
      kind: 'damage',
      summary: `Dano de ${npc.name} (${attack.name}): ${attack.dano} [${d.rolls.join(', ')}] = ${total}${target ? ' em ' + target.name : ''}`,
      rolls: d.rolls,
      total,
      dice: d.rolls,
      diceLabel: `Dano · ${attack.name}`,
    })
    if (target) {
      const newCurrent = Math.max(0, target.hp.current - total)
      await updateCharacter(table.id, target.id, { hp: { ...target.hp, current: newCurrent }, isAlive: newCurrent > 0 })
    }
  }

  const isSpecial = npc.flavor === 'special'

  if (editing) {
    return (
      <div className="sm:col-span-2">
        <SpecialCreatureForm
          initial={npc}
          submitLabel="Salvar ficha"
          onCancel={() => setEditing(false)}
          onSubmit={async (draft) => {
            await updateNPC(table.id, npc.id, {
              ...draft,
              // Mantém o PV atual dentro do novo máximo.
              hp: { current: Math.min(npc.hp.current, draft.hp.max), max: draft.hp.max },
              sourceLabel: draft.title || 'Criatura especial',
            })
            setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <Card className={`flex flex-col gap-2 p-3 ${isSpecial ? 'sm:col-span-2 border-[color:var(--gold)]/60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <PortraitEditor url={npc.portraitUrl} name={npc.name} size={isSpecial ? 52 : 40} onSave={savePortrait} />
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-purple-100">
              {isSpecial && <span className="text-[color:var(--gold)]">✦</span>}
              {npc.name}
            </p>
            {npc.title ? (
              <p className="font-serif text-xs uppercase tracking-[0.12em] text-[color:var(--gold)]">{npc.title}</p>
            ) : (
              npc.sourceLabel && <p className="text-xs text-purple-300/50">{npc.sourceLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isSpecial && (
            <button className="text-xs text-purple-300 hover:text-[color:var(--gold)]" onClick={() => setEditing(true)}>
              editar ficha
            </button>
          )}
          <button
            className="text-xs text-purple-400 hover:text-purple-200"
            onClick={() => updateNPC(table.id, npc.id, { visible: !npc.visible })}
            title="Visível para jogadores"
          >
            {npc.visible ? <Badge tone="good">visível</Badge> : <Badge>oculto</Badge>}
          </button>
          <button className="text-xs text-red-400 hover:text-red-200" onClick={() => deleteNPC(table.id, npc.id)}>
            excluir
          </button>
        </div>
      </div>

      {npc.description && <p className="text-xs leading-relaxed text-purple-200">{npc.description}</p>}

      {(npc.customStats ?? []).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[color:var(--gold-dark)] pt-2 text-xs">
          {(npc.customStats ?? []).map((s) => (
            <span key={s.id}>
              <span className="uppercase tracking-wider text-purple-400">{s.label}: </span>
              <span className="text-purple-100">{s.value}</span>
            </span>
          ))}
        </div>
      )}

      {(npc.traits ?? []).length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[color:var(--gold-dark)] pt-2">
          {(npc.traits ?? []).map((t) => (
            <p key={t.id} className="text-xs text-purple-200">
              <b className="text-[color:var(--gold)]">{t.name}</b>
              {t.description ? ` — ${t.description}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-purple-200">
        <span>Defesa {npc.defense}</span>
        <span>
          PV {npc.hp.current}/{npc.hp.max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full ${npc.hp.current / npc.hp.max > 0.5 ? 'bg-emerald-600' : npc.hp.current / npc.hp.max > 0.2 ? 'bg-amber-500' : 'bg-red-600'}`}
          style={{ width: `${Math.max(0, (npc.hp.current / npc.hp.max) * 100)}%` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <Input type="number" value={hpDelta} onChange={(e) => setHpDelta(Number(e.target.value))} className="w-14" />
        <Button variant="danger" onClick={() => applyHp(-hpDelta)}>
          − PV
        </Button>
        <Button variant="secondary" onClick={() => applyHp(hpDelta)}>
          + PV
        </Button>
      </div>

      {npc.attacks.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-purple-900/30 pt-2">
          <Select value={attackIdx} onChange={(e) => setAttackIdx(Number(e.target.value))} className="w-auto">
            {npc.attacks.map((a, i) => (
              <option key={a.id} value={i}>
                {a.name} ({a.dano})
              </option>
            ))}
          </Select>
          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-auto">
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <span className="text-xs text-purple-300/60">bônus</span>
          <Input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className="w-14" />
          <Button onClick={rollAttack}>🎲 Atacar (dano automático se acertar)</Button>
          <Button variant="danger" title="Rola dano extra, sem precisar de um novo ataque" onClick={rollDamageOnTarget}>
            💥 Dano Extra
          </Button>
        </div>
      )}
      {attack?.note && <p className="text-xs text-purple-300/50">{attack.note}</p>}
    </Card>
  )
}
