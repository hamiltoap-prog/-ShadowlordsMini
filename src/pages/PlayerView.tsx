import { useEffect, useState } from 'react'
import { CheckPanel } from '../components/CheckPanel'
import { DamageRoller } from '../components/DamageRoller'
import { LogFeed } from '../components/LogFeed'
import { SpellPanel } from '../components/SpellPanel'
import { XpPanel } from '../components/XpPanel'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { ARMORS, GEAR, WEAPONS } from '../data/equipment'
import { logCheck, logDamage, logNote, logSpell } from '../lib/actions'
import { totalDefense } from '../lib/characterMath'
import { newId } from '../lib/id'
import { listenCharacter, updateCharacter } from '../lib/store'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { Character, GameTable } from '../types'

export function PlayerView({ table, characterId }: { table: GameTable; characterId: string }) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [noteDraft, setNoteDraft] = useState('')
  const [hpDelta, setHpDelta] = useState(1)
  const [newItemName, setNewItemName] = useState('')

  useEffect(() => {
    setCharacter(undefined)
    return listenCharacter(table.id, characterId, (c) => {
      setCharacter(c)
      setNoteDraft((prev) => (c && document.activeElement?.id !== 'notes-field' ? c.notes : prev))
    })
  }, [table.id, characterId])

  if (character === undefined) {
    return <p className="p-6 text-center text-purple-300/60">Carregando personagem...</p>
  }
  if (character === null) {
    return <p className="p-6 text-center text-red-300">Personagem não encontrado.</p>
  }

  const actor = { tableId: table.id, actorName: character.name, actorType: 'player' as const, characterId: character.id }

  async function applyHp(delta: number) {
    if (!character) return
    const newCurrent = Math.max(0, Math.min(character.hp.max, character.hp.current + delta))
    await updateCharacter(table.id, character.id, { hp: { ...character.hp, current: newCurrent }, isAlive: newCurrent > 0 })
    await logNote(actor, `${delta > 0 ? 'recuperou' : 'sofreu'} ${Math.abs(delta)} PV (${newCurrent}/${character.hp.max})`, 'hp')
  }

  async function toggleEquip(kind: 'weapon' | 'armor', id: string) {
    if (!character) return
    if (kind === 'weapon') {
      const weapons = character.weapons.map((w) => (w.id === id ? { ...w, equipped: !w.equipped } : w))
      await updateCharacter(table.id, character.id, { weapons })
    } else {
      const armor = character.armor.map((a) => (a.id === id ? { ...a, equipped: !a.equipped } : a))
      const defense = totalDefense(character.baseDefense, armor)
      await updateCharacter(table.id, character.id, { armor, defense })
    }
  }

  async function removeItem(kind: 'weapon' | 'armor' | 'equipment', id: string) {
    if (!character) return
    if (kind === 'weapon') await updateCharacter(table.id, character.id, { weapons: character.weapons.filter((w) => w.id !== id) })
    else if (kind === 'armor') {
      const armor = character.armor.filter((a) => a.id !== id)
      await updateCharacter(table.id, character.id, { armor, defense: totalDefense(character.baseDefense, armor) })
    } else await updateCharacter(table.id, character.id, { equipment: character.equipment.filter((i) => i.id !== id) })
  }

  async function addGearItem(name: string) {
    if (!character || !name.trim()) return
    const existing = character.equipment.find((i) => i.name === name.trim())
    const equipment = existing
      ? character.equipment.map((i) => (i.name === name.trim() ? { ...i, qty: i.qty + 1 } : i))
      : [...character.equipment, { id: newId(), name: name.trim(), qty: 1 }]
    await updateCharacter(table.id, character.id, { equipment })
    setNewItemName('')
  }

  async function changeQty(id: string, delta: number) {
    if (!character) return
    const equipment = character.equipment
      .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty > 0)
    await updateCharacter(table.id, character.id, { equipment })
  }

  const weaponOptions = character.weapons.filter((w) => w.equipped).map((w) => ({ label: w.name, dano: w.dano }))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-16 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="font-serif text-2xl text-purple-100">{character.name}</h1>
              <p className="text-sm text-purple-300/60">
                {character.occupation} · {character.origin}
              </p>
            </div>
            {!character.isAlive && <Badge tone="bad">Morto</Badge>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs uppercase text-purple-400/60">Pontos de Vida</p>
              <div className="flex items-center gap-2">
                <div className="h-3 w-40 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={`h-full ${character.hp.current / character.hp.max > 0.5 ? 'bg-emerald-600' : character.hp.current / character.hp.max > 0.2 ? 'bg-amber-500' : 'bg-red-600'}`}
                    style={{ width: `${Math.max(0, (character.hp.current / character.hp.max) * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-purple-100">
                  {character.hp.current} / {character.hp.max}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <Input type="number" value={hpDelta} onChange={(e) => setHpDelta(Number(e.target.value))} className="w-16" />
                <Button variant="danger" onClick={() => applyHp(-hpDelta)}>
                  − Dano
                </Button>
                <Button variant="secondary" onClick={() => applyHp(hpDelta)}>
                  + Curar
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-purple-400/60">Defesa</p>
              <p className="text-xl text-purple-100">{character.defense}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-purple-400/60">Moedas</p>
              <p className="text-xl text-purple-100">{character.gold}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-2">Atributos</SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ATTRIBUTE_KEYS.map((k) => (
              <div key={k} className="rounded-lg border border-purple-900/40 bg-black/20 p-2 text-center">
                <p className="text-[10px] uppercase text-purple-400/60">{ATTRIBUTE_LABELS[k]}</p>
                <p className="text-lg text-purple-100">{character.attributes[k].score}</p>
                <p className="text-xs text-purple-300/60">
                  mod. {character.attributes[k].mod >= 0 ? '+' : ''}
                  {character.attributes[k].mod}
                </p>
              </div>
            ))}
          </div>
          {character.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {character.skills.map((s) => (
                <Badge key={s.name}>{s.name}</Badge>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Ações</SectionTitle>
          <CheckPanel
            title="Teste de Atributo"
            attributes={character.attributes}
            skills={character.skills}
            hpCurrent={character.hp.current}
            mode="test"
            allowTargetEdit
            targetLabel="Dificuldade"
            onConfirm={async (check, hpSpent) => {
              await logCheck(actor, check)
              if (hpSpent > 0) await applyHp(-hpSpent)
            }}
          />
          <CheckPanel
            title="Ataque"
            attributes={character.attributes}
            skills={character.skills}
            hpCurrent={character.hp.current}
            mode="attack"
            defaultAttr="for"
            defaultTarget={10}
            allowTargetEdit
            targetLabel="Defesa do Alvo"
            onConfirm={async (check, hpSpent) => {
              await logCheck(actor, check)
              if (hpSpent > 0) await applyHp(-hpSpent)
            }}
          />
          <div className="rounded-lg border border-purple-900/40 bg-black/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-300/70">Dano</p>
            <DamageRoller
              options={weaponOptions.length ? weaponOptions : [{ label: 'Desarmado', dano: '1d3' }]}
              attributes={character.attributes}
              onConfirm={(dmg) => logDamage(actor, dmg)}
            />
          </div>
          <SpellPanel
            attributes={character.attributes}
            skills={character.skills}
            hpCurrent={character.hp.current}
            onConfirm={async (spellName, result) => {
              await logSpell(actor, spellName, result)
              await applyHp(-result.pvCost)
            }}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-2">Inventário</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/60">Armas</p>
              {character.weapons.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                  <span className={w.equipped ? 'text-purple-100' : 'text-purple-400/50 line-through'}>
                    {w.name} ({w.dano})
                  </span>
                  <span className="flex gap-1">
                    <button className="text-xs text-purple-400 hover:text-purple-200" onClick={() => toggleEquip('weapon', w.id)}>
                      {w.equipped ? 'guardar' : 'equipar'}
                    </button>
                    <button className="text-xs text-red-400 hover:text-red-200" onClick={() => removeItem('weapon', w.id)}>
                      remover
                    </button>
                  </span>
                </div>
              ))}
              <AddFromList label="+ arma" options={WEAPONS.map((w) => w.name)} onAdd={(name) => {
                const w = WEAPONS.find((x) => x.name === name)
                if (!w || !character) return
                updateCharacter(table.id, character.id, {
                  weapons: [...character.weapons, { id: newId(), name: w.name, dano: w.dano, habilidade: w.habilidade, tipo: w.tipo, equipped: true }],
                })
              }} />
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/60">Armaduras</p>
              {character.armor.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                  <span className={a.equipped ? 'text-purple-100' : 'text-purple-400/50 line-through'}>
                    {a.name} (+{a.defesaBonus})
                  </span>
                  <span className="flex gap-1">
                    <button className="text-xs text-purple-400 hover:text-purple-200" onClick={() => toggleEquip('armor', a.id)}>
                      {a.equipped ? 'guardar' : 'equipar'}
                    </button>
                    <button className="text-xs text-red-400 hover:text-red-200" onClick={() => removeItem('armor', a.id)}>
                      remover
                    </button>
                  </span>
                </div>
              ))}
              <AddFromList label="+ armadura" options={ARMORS.map((a) => a.name)} onAdd={(name) => {
                const a = ARMORS.find((x) => x.name === name)
                if (!a || !character) return
                const armor = [...character.armor, { id: newId(), name: a.name, defesaBonus: a.defesa, protecao: a.protecao, equipped: true }]
                updateCharacter(table.id, character.id, { armor, defense: totalDefense(character.baseDefense, armor) })
              }} />
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs uppercase text-purple-400/60">Equipamento</p>
            {character.equipment.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
                <span className="text-purple-100">{i.name}</span>
                <span className="flex items-center gap-2">
                  <button className="text-purple-400 hover:text-purple-200" onClick={() => changeQty(i.id, -1)}>
                    −
                  </button>
                  <span>{i.qty}</span>
                  <button className="text-purple-400 hover:text-purple-200" onClick={() => changeQty(i.id, 1)}>
                    +
                  </button>
                </span>
              </div>
            ))}
            <div className="mt-1 flex gap-2">
              <AddFromList label="+ item" options={GEAR.map((g) => g.name)} onAdd={addGearItem} />
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item personalizado"
                className="w-40"
              />
              <Button onClick={() => addGearItem(newItemName)}>Adicionar</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-2">Experiência</SectionTitle>
          <XpPanel
            character={character}
            onApply={async (patch, summary) => {
              await updateCharacter(table.id, character.id, patch)
              await logNote(actor, summary, 'xp')
            }}
          />
        </Card>

        <Card className="p-4">
          <SectionTitle className="mb-2">Anotações</SectionTitle>
          <textarea
            id="notes-field"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => updateCharacter(table.id, character.id, { notes: noteDraft })}
            rows={4}
            className="w-full rounded-lg border border-purple-900/50 bg-[#0f0d16] p-2 text-sm text-purple-50 outline-none focus:border-purple-500"
            placeholder="Segredos, objetivos, contatos..."
          />
        </Card>
      </div>

      <div className="lg:sticky lg:top-4">
        <LogFeed tableId={table.id} />
      </div>
    </div>
  )
}

function AddFromList({ label, options, onAdd }: { label: string; options: string[]; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(options[0])
  if (!open) {
    return (
      <button className="mt-1 text-xs text-purple-400 hover:text-purple-200" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className="mt-1 flex gap-1">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-purple-900/50 bg-[#0f0d16] px-2 py-1 text-xs text-purple-50"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <button
        className="rounded-lg bg-purple-700 px-2 py-1 text-xs text-white"
        onClick={() => {
          onAdd(value)
          setOpen(false)
        }}
      >
        ok
      </button>
    </div>
  )
}
