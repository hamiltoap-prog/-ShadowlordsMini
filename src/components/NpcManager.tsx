import { useState } from 'react'
import { BESTIARY, BESTIARY_CATEGORIES } from '../data/bestiary'
import { roll, roll3d6 } from '../lib/dice'
import { newId } from '../lib/id'
import { addLogEntry, createNPC, deleteNPC, updateCharacter, updateNPC } from '../lib/store'
import type { Character, GameTable, NPC } from '../types'
import { Badge, Button, Card, Input, Select, SectionTitle } from './ui'

export function NpcManager({ table, npcs, characters }: { table: GameTable; npcs: NPC[]; characters: Character[] }) {
  const [category, setCategory] = useState(BESTIARY_CATEGORIES[0])
  const [bestiaryChoice, setBestiaryChoice] = useState(BESTIARY.find((b) => b.category === BESTIARY_CATEGORIES[0])?.name ?? '')
  const [customName, setCustomName] = useState('')

  const categoryOptions = BESTIARY.filter((b) => b.category === category)

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
      visible: false,
      createdAt: Date.now(),
    })
    setCustomName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Adicionar NPC / Monstro</SectionTitle>
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
          <Button variant="primary" onClick={addFromBestiary}>
            Adicionar do Bestiário
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nome de NPC personalizado" className="w-56" />
          <Button onClick={addCustom}>Adicionar Personalizado</Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {npcs.map((npc) => (
          <NpcCard key={npc.id} table={table} npc={npc} characters={characters} />
        ))}
        {npcs.length === 0 && <p className="text-sm text-purple-300/50">Nenhum NPC nesta mesa ainda.</p>}
      </div>
    </div>
  )
}

function NpcCard({ table, npc, characters }: { table: GameTable; npc: NPC; characters: Character[] }) {
  const [hpDelta, setHpDelta] = useState(1)
  const [targetId, setTargetId] = useState(characters[0]?.id ?? '')
  const [attackIdx, setAttackIdx] = useState(0)
  const [bonus, setBonus] = useState(0)

  const target = characters.find((c) => c.id === targetId)
  const attack = npc.attacks[attackIdx]

  async function applyHp(delta: number) {
    const newCurrent = Math.max(0, Math.min(npc.hp.max, npc.hp.current + delta))
    await updateNPC(table.id, npc.id, { hp: { ...npc.hp, current: newCurrent } })
  }

  async function rollAttack() {
    if (!target || !attack) return
    const r = roll3d6()
    const total = r.total + bonus
    const success = total >= target.defense
    await addLogEntry(table.id, {
      actorName: npc.name,
      actorType: 'gm',
      kind: 'attack',
      summary: `${npc.name} ataca ${target.name} com ${attack.name}: 3d6 [${r.rolls.join(', ')}] ${bonus ? (bonus >= 0 ? '+' : '') + bonus : ''} = ${total} vs Defesa ${target.defense} → ${success ? 'Sucesso' : 'Fracasso'}`,
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

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-purple-100">{npc.name}</p>
          {npc.sourceLabel && <p className="text-xs text-purple-300/50">{npc.sourceLabel}</p>}
        </div>
        <div className="flex gap-1">
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
          <Button onClick={rollAttack}>🎲 Atacar</Button>
          <Button variant="danger" onClick={rollDamageOnTarget}>
            💥 Dano no Alvo
          </Button>
        </div>
      )}
      {attack?.note && <p className="text-xs text-purple-300/50">{attack.note}</p>}
    </Card>
  )
}
