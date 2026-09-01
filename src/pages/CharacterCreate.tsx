import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Select, SectionTitle } from '../components/ui'
import {
  baseDefenseFromAgi,
  emptyAttributes,
  recomputeMod,
  rollAllAttributes,
  rollStartingHp,
  sumModifiers,
  totalDefense,
} from '../lib/characterMath'
import { d66RangeIndex, roll1d66, roll3d6 } from '../lib/dice'
import { newId } from '../lib/id'
import { ARMORS, GEAR, WEAPONS } from '../data/equipment'
import { OCCUPATIONS } from '../data/occupations'
import { ORIGINS } from '../data/origins'
import { NAMES } from '../data/names'
import { createCharacter } from '../lib/store'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Attributes, CarriedArmor, CarriedWeapon, Character, GameTable, InventoryItem } from '../types'

function splitList(text: string): string[] {
  if (!text || text === '—') return []
  return text
    .split(/,| e /i)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function CharacterCreate({
  table,
  uid,
  nickname,
  onCreated,
}: {
  table: GameTable
  uid: string
  nickname: string
  onCreated: (c: Character) => void
}) {
  const [name, setName] = useState('')
  const [occIdx, setOccIdx] = useState<number | null>(null)
  const [originIdx, setOriginIdx] = useState<number | null>(null)
  const [chosenOriginSkills, setChosenOriginSkills] = useState<string[]>([])
  const [attributes, setAttributes] = useState<Attributes>(emptyAttributes())
  const [attributesRolled, setAttributesRolled] = useState(false)
  const [hp, setHp] = useState<number | null>(null)
  const [gold, setGold] = useState<number | null>(null)
  const [weapons, setWeapons] = useState<CarriedWeapon[]>([])
  const [armor, setArmor] = useState<CarriedArmor[]>([])
  const [equipment, setEquipment] = useState<InventoryItem[]>([])
  const [shopWeapon, setShopWeapon] = useState(WEAPONS[0].name)
  const [shopArmor, setShopArmor] = useState(ARMORS[0].name)
  const [shopGear, setShopGear] = useState(GEAR[0].name)
  const [saving, setSaving] = useState(false)

  const occupation = occIdx !== null ? OCCUPATIONS[occIdx] : null
  const origin = originIdx !== null ? ORIGINS[originIdx] : null
  const originSkillCount = Math.max(1, attributes.sab.mod + 1)
  const baseDefense = baseDefenseFromAgi(attributes)
  const defense = totalDefense(baseDefense, armor)

  const occupationSkills = occupation ? splitList(occupation.habilidade) : []

  function rollName() {
    const r = roll1d66()
    setName(NAMES[r.index36] ?? NAMES[0])
  }

  function rollOccupation() {
    const r = roll1d66()
    const idx = d66RangeIndex(r.value, OCCUPATIONS.map((o) => o.d66))
    setOccIdx(idx)
    const occ = OCCUPATIONS[idx]
    const startWeapons: CarriedWeapon[] = splitList(occ.arma)
      .map((wName) => WEAPONS.find((w) => w.name === wName))
      .filter((w): w is (typeof WEAPONS)[number] => Boolean(w))
      .map((w) => ({ id: newId(), name: w.name, dano: w.dano, habilidade: w.habilidade, tipo: w.tipo, equipped: true }))
    setWeapons(startWeapons)
  }

  function rollOrigin() {
    const r = roll1d66()
    const idx = d66RangeIndex(r.value, ORIGINS.map((o) => o.d66))
    setOriginIdx(idx)
    setChosenOriginSkills([])
  }

  function doRollAttributes() {
    const attrs = rollAllAttributes()
    setAttributes(attrs)
    setAttributesRolled(true)
    setHp(rollStartingHp(attrs))
  }

  function rerollAttribute(key: AttributeKey) {
    const attrs = { ...attributes }
    const r = roll3d6()
    const score = r.total <= 8 ? 9 : r.total
    attrs[key] = { score, mod: recomputeMod(score) }
    setAttributes(attrs)
  }

  function setManualScore(key: AttributeKey, score: number) {
    const attrs = { ...attributes }
    attrs[key] = { score, mod: recomputeMod(score) }
    setAttributes(attrs)
  }

  function rollGold() {
    setGold(roll3d6().total)
  }

  function toggleOriginSkill(skill: string) {
    setChosenOriginSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill)
      if (prev.length >= originSkillCount) return prev
      return [...prev, skill]
    })
  }

  function buyWeapon() {
    const w = WEAPONS.find((x) => x.name === shopWeapon)
    if (!w || gold === null || gold < w.custo) return
    setGold(gold - w.custo)
    setWeapons((prev) => [...prev, { id: newId(), name: w.name, dano: w.dano, habilidade: w.habilidade, tipo: w.tipo, equipped: true }])
  }

  function buyArmor() {
    const a = ARMORS.find((x) => x.name === shopArmor)
    if (!a || gold === null || gold < a.custo) return
    setGold(gold - a.custo)
    setArmor((prev) => [...prev, { id: newId(), name: a.name, defesaBonus: a.defesa, protecao: a.protecao, equipped: true }])
  }

  function buyGear() {
    const g = GEAR.find((x) => x.name === shopGear)
    if (!g || gold === null || gold < g.custo) return
    setGold(gold - g.custo)
    setEquipment((prev) => {
      const existing = prev.find((i) => i.name === g.name)
      if (existing) return prev.map((i) => (i.name === g.name ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { id: newId(), name: g.name, qty: 1 }]
    })
  }

  const allSkills = useMemo(() => {
    const set = new Set<string>([...occupationSkills, ...chosenOriginSkills])
    return Array.from(set)
  }, [occupationSkills, chosenOriginSkills])

  const canSubmit =
    name.trim().length > 0 &&
    occupation !== null &&
    origin !== null &&
    attributesRolled &&
    chosenOriginSkills.length === originSkillCount &&
    hp !== null

  async function submit() {
    if (!canSubmit || !occupation || !origin || hp === null) return
    setSaving(true)
    try {
      const now = Date.now()
      const character: Omit<Character, 'id'> = {
        tableId: table.id,
        ownerUid: uid,
        playerNickname: nickname,
        name: name.trim(),
        occupation: occupation.name,
        origin: origin.name,
        attributes,
        hp: { current: hp, max: hp },
        defense,
        baseDefense,
        skills: allSkills.map((s) => ({ name: s })),
        weapons,
        armor,
        equipment,
        gold: gold ?? 0,
        xp: 0,
        xpSpent: 0,
        notes: '',
        createdAt: now,
        updatedAt: now,
        isAlive: true,
      }
      const created = await createCharacter(table.id, character)
      onCreated(created)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 pb-16">
      <div>
        <h1 className="font-serif text-2xl text-purple-100">Criar Personagem</h1>
        <p className="text-sm text-purple-300/60">
          Mesa <span className="text-purple-200">{table.name}</span> · jogando como{' '}
          <span className="text-purple-200">{nickname}</span>
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Nome do Personagem</SectionTitle>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cindar, o Andarilho" />
          <Button onClick={rollName}>🎲 Rolar (1d66)</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Atributos</SectionTitle>
        <p className="text-xs text-purple-300/50">
          3d6 por atributo (resultado 8 ou menos vira 9). PV = 1d6+6 + soma dos Modificadores.
        </p>
        <Button variant="primary" onClick={doRollAttributes} className="self-start">
          🎲 Rolar Atributos e PV
        </Button>
        {attributesRolled && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ATTRIBUTE_KEYS.map((k) => (
              <div key={k} className="rounded-lg border border-purple-900/40 bg-black/20 p-2">
                <div className="flex items-center justify-between text-xs text-purple-300/60">
                  <span>{ATTRIBUTE_LABELS[k]}</span>
                  <button className="text-purple-400 hover:text-purple-200" onClick={() => rerollAttribute(k)} title="Rolar de novo">
                    ↻
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number"
                    value={attributes[k].score}
                    onChange={(e) => setManualScore(k, Number(e.target.value))}
                    className="w-16 text-center"
                  />
                  <span className="text-sm text-purple-200">
                    mod. {attributes[k].mod >= 0 ? '+' : ''}
                    {attributes[k].mod}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {attributesRolled && (
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-purple-200">
            <span>
              Soma dos Modificadores: <b>{sumModifiers(attributes)}</b>
            </span>
            <span>
              Pontos de Vida: <b>{hp}</b>
            </span>
            <span>
              Defesa base: <b>{baseDefense}</b> (10 + mod. Agilidade)
            </span>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Ocupação (1d66)</SectionTitle>
        <Button onClick={rollOccupation} className="self-start">
          🎲 Rolar Ocupação
        </Button>
        {occupation && (
          <div className="rounded-lg border border-purple-900/40 bg-black/20 p-3 text-sm">
            <p className="font-semibold text-purple-100">{occupation.name}</p>
            <p className="text-purple-300/70">Arma inicial: {occupation.arma}</p>
            <p className="text-purple-300/70">Habilidades: {occupation.habilidade}</p>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Origem (1d66)</SectionTitle>
        <Button onClick={rollOrigin} className="self-start">
          🎲 Rolar Origem
        </Button>
        {origin && (
          <div className="rounded-lg border border-purple-900/40 bg-black/20 p-3 text-sm">
            <p className="font-semibold text-purple-100">{origin.name}</p>
            <p className="mb-2 text-purple-300/70">
              Escolha {originSkillCount} Habilidade{originSkillCount > 1 ? 's' : ''} (Modificador de Sabedoria + 1):
            </p>
            <div className="flex flex-wrap gap-2">
              {origin.habilidades.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleOriginSkill(s)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    chosenOriginSkills.includes(s)
                      ? 'border-purple-500 bg-purple-700/50 text-white'
                      : 'border-purple-900/50 text-purple-300/70 hover:border-purple-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {allSkills.length > 0 && (
        <Card className="p-4">
          <SectionTitle className="mb-2">Habilidades Finais</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {allSkills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Tesouro Inicial e Equipamentos</SectionTitle>
        <div className="flex items-center gap-2">
          <Button onClick={rollGold}>🎲 Rolar Tesouro (3d6)</Button>
          {gold !== null && (
            <span className="text-sm text-purple-200">
              Moedas disponíveis: <b>{gold}</b>
            </span>
          )}
        </div>

        {gold !== null && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Select value={shopWeapon} onChange={(e) => setShopWeapon(e.target.value)}>
                {WEAPONS.map((w) => (
                  <option key={w.name} value={w.name}>
                    {w.name} ({w.dano}) — {w.custo}
                  </option>
                ))}
              </Select>
              <Button onClick={buyWeapon}>Comprar Arma</Button>
            </div>
            <div className="flex flex-col gap-1">
              <Select value={shopArmor} onChange={(e) => setShopArmor(e.target.value)}>
                {ARMORS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name} (+{a.defesa} Def) — {a.custo}
                  </option>
                ))}
              </Select>
              <Button onClick={buyArmor}>Comprar Armadura</Button>
            </div>
            <div className="flex flex-col gap-1">
              <Select value={shopGear} onChange={(e) => setShopGear(e.target.value)}>
                {GEAR.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} — {g.custo}
                  </option>
                ))}
              </Select>
              <Button onClick={buyGear}>Comprar Item</Button>
            </div>
          </div>
        )}

        {(weapons.length > 0 || armor.length > 0 || equipment.length > 0) && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/70">Armas</p>
              {weapons.map((w) => (
                <p key={w.id} className="text-sm text-purple-100">
                  {w.name} ({w.dano})
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/70">Armaduras</p>
              {armor.map((a) => (
                <p key={a.id} className="text-sm text-purple-100">
                  {a.name} (+{a.defesaBonus})
                </p>
              ))}
              <p className="mt-1 text-sm text-purple-300/70">Defesa total: {defense}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/70">Equipamento</p>
              {equipment.map((i) => (
                <p key={i.id} className="text-sm text-purple-100">
                  {i.name} x{i.qty}
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Button variant="primary" disabled={!canSubmit || saving} onClick={submit} className="self-end px-6 py-2 text-base">
        {saving ? 'Criando...' : 'Entrar na Aventura ⚔️'}
      </Button>
    </div>
  )
}
