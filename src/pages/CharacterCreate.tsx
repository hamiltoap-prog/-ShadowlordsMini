import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { InfoButton } from '../components/InfoButton'
import { Portrait } from '../components/Portrait'
import {
  baseDefenseFromAgi,
  emptyAttributes,
  rollAllAttributes,
  rollStartingHp,
  sumModifiers,
  totalDefense,
} from '../lib/characterMath'
import { d66RangeIndex, roll1d66, roll3d6, roll1d6 } from '../lib/dice'
import { normalizeImageUrl } from '../lib/imageUrl'
import { newId } from '../lib/id'
import { ARMORS, GEAR, WEAPONS } from '../data/equipment'
import { OCCUPATIONS } from '../data/occupations'
import { ORIGINS } from '../data/origins'
import { SKILLS } from '../data/skills'
import { NAMES } from '../data/names'
import { ANCESTRIES } from '../data/ancestry'
import { createCharacter } from '../lib/store'
import { ANCESTRY_KEYS, ANCESTRY_LABELS, ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type {
  AncestryChoice,
  AncestryKey,
  Attributes,
  CarriedArmor,
  CarriedWeapon,
  Character,
  GameTable,
  InventoryItem,
} from '../types'

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
  suggestedName,
  onCreated,
}: {
  table: GameTable
  uid: string
  nickname: string
  suggestedName?: string
  onCreated: (c: Character) => void
}) {
  const [name, setName] = useState(suggestedName ?? '')
  const [playerName, setPlayerName] = useState(nickname === 'Jogador' ? '' : nickname)
  const [portraitUrl, setPortraitUrl] = useState('')
  const [ancestry, setAncestry] = useState<AncestryKey | null>(null)
  const [ancestryChoice, setAncestryChoice] = useState<AncestryChoice>('ranged')
  const [occIdx, setOccIdx] = useState<number | null>(null)
  const [originIdx, setOriginIdx] = useState<number | null>(null)
  const [chosenOriginSkills, setChosenOriginSkills] = useState<string[]>([])
  const [extraSkills, setExtraSkills] = useState<string[]>([])
  const [attributes, setAttributes] = useState<Attributes>(emptyAttributes())
  const [attributesRolled, setAttributesRolled] = useState(false)
  const [hp, setHp] = useState<number | null>(null)
  const [gold, setGold] = useState<number | null>(null)
  const [weapons, setWeapons] = useState<CarriedWeapon[]>([])
  const [armor, setArmor] = useState<CarriedArmor[]>([])
  const [equipment, setEquipment] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const occupation = occIdx !== null ? OCCUPATIONS[occIdx] : null
  const origin = originIdx !== null ? ORIGINS[originIdx] : null
  const originSkillCount = Math.max(1, attributes.sab.mod + 1) + (ancestry === 'humano' ? 1 : 0)
  const baseDefense = baseDefenseFromAgi(attributes)
  const defense = totalDefense(baseDefense, armor)
  const occupationSkills = occupation ? splitList(occupation.habilidade) : []

  function pickOccupation(idx: number) {
    setOccIdx(idx)
    const occ = OCCUPATIONS[idx]
    const startWeapons: CarriedWeapon[] = splitList(occ.arma)
      .map((wName) => WEAPONS.find((w) => w.name === wName))
      .filter((w): w is (typeof WEAPONS)[number] => Boolean(w))
      .map((w) => ({ id: newId(), name: w.name, dano: w.dano, habilidade: w.habilidade, tipo: w.tipo, equipped: true }))
    setWeapons(startWeapons)
  }

  function pickOrigin(idx: number) {
    setOriginIdx(idx)
    setChosenOriginSkills([])
  }

  function doRollAttributes() {
    const attrs = rollAllAttributes()
    setAttributes(attrs)
    setAttributesRolled(true)
    setHp(rollStartingHp(attrs, ancestry ?? undefined))
  }

  function pickAncestry(key: AncestryKey) {
    setAncestry(key)
    // Recalcula o PV se os atributos já tinham sido rolados (Anão ganha +2 e vantagem).
    if (attributesRolled) setHp(rollStartingHp(attributes, key))
  }

  function toggleOriginSkill(skill: string) {
    setChosenOriginSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill)
      if (prev.length >= originSkillCount) return prev
      return [...prev, skill]
    })
  }

  function toggleExtraSkill(skill: string) {
    setExtraSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]))
  }

  function buy(kind: 'weapon' | 'armor' | 'gear', itemName: string) {
    if (gold === null) return
    if (kind === 'weapon') {
      const w = WEAPONS.find((x) => x.name === itemName)
      if (!w || gold < w.custo) return
      setGold(gold - w.custo)
      setWeapons((prev) => [
        ...prev,
        { id: newId(), name: w.name, dano: w.dano, habilidade: w.habilidade, tipo: w.tipo, equipped: true },
      ])
    } else if (kind === 'armor') {
      const a = ARMORS.find((x) => x.name === itemName)
      if (!a || gold < a.custo) return
      setGold(gold - a.custo)
      setArmor((prev) => [
        ...prev,
        { id: newId(), name: a.name, defesaBonus: a.defesa, protecao: a.protecao, equipped: true },
      ])
    } else {
      const g = GEAR.find((x) => x.name === itemName)
      if (!g || gold < g.custo) return
      setGold(gold - g.custo)
      setEquipment((prev) => {
        const existing = prev.find((i) => i.name === g.name)
        if (existing) return prev.map((i) => (i.name === g.name ? { ...i, qty: i.qty + 1 } : i))
        return [...prev, { id: newId(), name: g.name, qty: 1 }]
      })
    }
  }

  const allSkills = useMemo(
    () => Array.from(new Set([...occupationSkills, ...chosenOriginSkills, ...extraSkills])),
    [occupationSkills, chosenOriginSkills, extraSkills],
  )

  const canSubmit =
    name.trim().length > 0 &&
    ancestry !== null &&
    occupation !== null &&
    origin !== null &&
    attributesRolled &&
    chosenOriginSkills.length === originSkillCount &&
    hp !== null

  async function submit() {
    if (!canSubmit || !occupation || !origin || hp === null) return
    setSaving(true)
    setError('')
    try {
      const now = Date.now()
      const character: Omit<Character, 'id'> = {
        tableId: table.id,
        ownerUid: uid,
        playerNickname: playerName.trim() || nickname,
        name: name.trim(),
        nameLower: name.trim().toLowerCase(),
        occupation: occupation.name,
        origin: origin.name,
        ancestry: ancestry ?? undefined,
        ancestryChoice: ancestry === 'elfo' ? ancestryChoice : undefined,
        racialResourceUsed: 0,
        conditions: [],
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
        portraitUrl: normalizeImageUrl(portraitUrl) || undefined,
        createdAt: now,
        updatedAt: now,
        isAlive: true,
      }
      const created = await createCharacter(table.id, character)
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar o personagem.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 pb-16">
      <div>
        <h1 className="font-serif text-2xl text-purple-100">Criar Personagem</h1>
        <p className="text-sm text-purple-300/60">
          Mesa <span className="text-purple-200">{table.name}</span> · escolha cada opção lendo as descrições, ou deixe
          os dados decidirem.
        </p>
      </div>

      {/* Identidade */}
      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Identidade</SectionTitle>
        <div className="flex gap-3">
          <Portrait url={portraitUrl} name={name || '?'} size={64} />
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do personagem" />
              <Button onClick={() => setName(NAMES[roll1d66().index36] ?? NAMES[0])}>🎲</Button>
            </div>
            <Input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Seu nome (jogador)" />
            <Input
              value={portraitUrl}
              onChange={(e) => setPortraitUrl(e.target.value)}
              onBlur={() => setPortraitUrl((u) => normalizeImageUrl(u))}
              placeholder="URL da foto de perfil (opcional, aceita link do Google Drive)"
            />
          </div>
        </div>
        <p className="text-xs text-purple-300/50">
          A foto é carregada por link (ex: clique com o botão direito numa imagem da web → "Copiar endereço da imagem").
        </p>
      </Card>

      {/* Ancestralidade */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Ancestralidade</SectionTitle>
          <Button onClick={() => pickAncestry(ANCESTRY_KEYS[roll1d6() - 1])}>🎲 Sortear</Button>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ANCESTRIES.map((a) => (
            <button
              key={a.key}
              onClick={() => pickAncestry(a.key)}
              className={`rounded-lg border p-2 text-left text-sm transition ${
                ancestry === a.key
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
              }`}
            >
              <p className="text-purple-100">
                {a.name} <span className="text-xs text-purple-300/60">— {a.title}</span>
              </p>
              <p className="text-xs text-purple-300/60">{a.description}</p>
            </button>
          ))}
        </div>
        {ancestry === 'elfo' && (
          <div className="flex items-center gap-3 rounded-lg border border-purple-900/40 bg-black/20 p-2 text-sm">
            <span className="text-purple-200">Visão Longínqua se aplica a:</span>
            <label className="flex items-center gap-1 text-purple-200">
              <input
                type="radio"
                checked={ancestryChoice === 'ranged'}
                onChange={() => setAncestryChoice('ranged')}
              />
              Ataques à distância (Pontaria)
            </label>
            <label className="flex items-center gap-1 text-purple-200">
              <input type="radio" checked={ancestryChoice === 'spell'} onChange={() => setAncestryChoice('spell')} />
              Testes de conjuração
            </label>
          </div>
        )}
      </Card>

      {/* Atributos */}
      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Atributos</SectionTitle>
        <p className="text-xs text-purple-300/50">
          Pelo manual, os Atributos são sempre sorteados: 3d6 cada (resultado 8 ou menos vira 9). PV = 1d6+6 + soma dos
          Modificadores. Só o Mestre pode ajustar esses valores depois.
        </p>
        <Button variant="primary" onClick={doRollAttributes} className="self-start">
          🎲 {attributesRolled ? 'Rolar novamente' : 'Rolar Atributos e PV'}
        </Button>
        {attributesRolled && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ATTRIBUTE_KEYS.map((k) => (
                <div key={k} className="rounded-lg border border-purple-900/40 bg-black/20 p-2 text-center">
                  <p className="text-[10px] uppercase text-purple-400/60">{ATTRIBUTE_LABELS[k]}</p>
                  <p className="text-lg text-purple-100">{attributes[k].score}</p>
                  <p className="text-xs text-purple-300/60">
                    mod. {attributes[k].mod >= 0 ? '+' : ''}
                    {attributes[k].mod}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-purple-200">
              <span>
                Soma dos Modificadores: <b>{sumModifiers(attributes)}</b>
              </span>
              <span>
                Pontos de Vida: <b>{hp}</b>
              </span>
              <span>
                Defesa: <b>{defense}</b>
              </span>
              {ancestry && (
                <span>
                  Ancestralidade: <b>{ANCESTRY_LABELS[ancestry]}</b>
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Ocupação */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Ocupação</SectionTitle>
          <Button onClick={() => pickOccupation(d66RangeIndex(roll1d66().value, OCCUPATIONS.map((o) => o.d66)))}>
            🎲 Sortear
          </Button>
        </div>
        <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {OCCUPATIONS.map((o, i) => (
            <button
              key={o.name}
              onClick={() => pickOccupation(i)}
              className={`rounded-lg border p-2 text-left text-sm transition ${
                occIdx === i
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
              }`}
            >
              <p className="text-purple-100">{o.name}</p>
              <p className="text-xs text-purple-300/60">
                Arma: {o.arma} · Habilidades: {o.habilidade}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Origem */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Origem</SectionTitle>
          <Button onClick={() => pickOrigin(d66RangeIndex(roll1d66().value, ORIGINS.map((o) => o.d66)))}>🎲 Sortear</Button>
        </div>
        <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {ORIGINS.map((o, i) => (
            <div
              key={o.name}
              role="button"
              tabIndex={0}
              onClick={() => pickOrigin(i)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pickOrigin(i)}
              className={`cursor-pointer rounded-lg border p-2 text-left text-sm transition ${
                originIdx === i
                  ? 'border-purple-500 bg-purple-900/30'
                  : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
              }`}
            >
              <p className="flex items-center gap-1.5 text-purple-100">
                {o.name}
                <InfoButton title={o.name} text={o.lore} />
              </p>
              <p className="text-xs text-purple-300/60">{o.habilidades.join(', ')}</p>
            </div>
          ))}
        </div>
        {origin && (
          <div className="rounded-lg border border-purple-900/40 bg-black/20 p-3">
            <p className="mb-2 text-sm text-purple-200">
              Escolha {originSkillCount} Habilidade{originSkillCount > 1 ? 's' : ''} de {origin.name} (Modificador de
              Sabedoria + 1):
            </p>
            <div className="flex flex-wrap gap-2">
              {origin.habilidades.map((s) => {
                const chosen = chosenOriginSkills.includes(s)
                const def = SKILLS.find((x) => x.name === s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleOriginSkill(s)}
                    title={def?.description}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      chosen
                        ? 'border-purple-500 bg-purple-700/50 text-white'
                        : 'border-purple-900/50 text-purple-300/70 hover:border-purple-600'
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Habilidades extras (opcional) */}
      <Card className="flex flex-col gap-2 p-4">
        <SectionTitle>Habilidades Extras (opcional)</SectionTitle>
        <p className="text-xs text-purple-300/50">
          O manual permite escolher Habilidades livremente como regra da casa. Combine com seu Mestre antes de marcar.
        </p>
        <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
          {SKILLS.map((s) => {
            const already = occupationSkills.includes(s.name) || chosenOriginSkills.includes(s.name)
            const chosen = extraSkills.includes(s.name)
            return (
              <button
                key={s.name}
                disabled={already}
                onClick={() => toggleExtraSkill(s.name)}
                className={`rounded-lg border p-2 text-left text-xs transition disabled:opacity-40 ${
                  chosen ? 'border-purple-500 bg-purple-900/30' : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
                }`}
              >
                <span className="text-purple-100">{s.name}</span>
                <span className="block text-purple-300/60">{s.description}</span>
              </button>
            )
          })}
        </div>
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

      {/* Equipamento inicial */}
      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Tesouro Inicial e Equipamentos</SectionTitle>
        <div className="flex items-center gap-3">
          <Button onClick={() => setGold(roll3d6().total)}>🎲 Rolar Tesouro (3d6)</Button>
          {gold !== null && (
            <span className="text-sm text-purple-200">
              Moedas: <b>{gold}</b>
            </span>
          )}
          <span className="text-xs text-purple-300/50">A arma da Ocupação já vem sem custo.</span>
        </div>

        {gold !== null && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ShopList title="Armas" items={WEAPONS.map((w) => ({ name: w.name, custo: w.custo, extra: w.dano }))} gold={gold} onBuy={(n) => buy('weapon', n)} />
            <ShopList title="Armaduras" items={ARMORS.map((a) => ({ name: a.name, custo: a.custo, extra: `+${a.defesa} Def` }))} gold={gold} onBuy={(n) => buy('armor', n)} />
            <ShopList title="Equipamentos" items={GEAR.map((g) => ({ name: g.name, custo: g.custo }))} gold={gold} onBuy={(n) => buy('gear', n)} />
          </div>
        )}

        {(weapons.length > 0 || armor.length > 0 || equipment.length > 0) && (
          <div className="grid gap-2 border-t border-purple-900/30 pt-3 sm:grid-cols-3">
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

      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button variant="primary" disabled={!canSubmit || saving} onClick={submit} className="self-end px-6 py-2 text-base">
        {saving ? 'Criando...' : 'Entrar na Aventura ⚔️'}
      </Button>
      {!canSubmit && (
        <p className="self-end text-xs text-purple-300/50">
          Faltando: {!name.trim() && 'nome · '}
          {!ancestry && 'ancestralidade · '}
          {!attributesRolled && 'rolar atributos · '}
          {!occupation && 'ocupação · '}
          {!origin && 'origem · '}
          {origin && chosenOriginSkills.length !== originSkillCount && 'habilidades da origem'}
        </p>
      )}
    </div>
  )
}

function ShopList({
  title,
  items,
  gold,
  onBuy,
}: {
  title: string
  items: { name: string; custo: number; extra?: string }[]
  gold: number
  onBuy: (name: string) => void
}) {
  return (
    <div className="rounded-lg border border-purple-900/30 bg-black/20 p-2">
      <p className="mb-1 text-xs uppercase text-purple-400/70">{title}</p>
      <div className="max-h-48 overflow-y-auto">
        {items.map((i) => (
          <button
            key={i.name}
            disabled={gold < i.custo}
            onClick={() => onBuy(i.name)}
            className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-xs text-purple-100 hover:bg-purple-900/30 disabled:opacity-30"
          >
            <span>
              {i.name} {i.extra && <span className="text-purple-300/50">({i.extra})</span>}
            </span>
            <span className="text-amber-300/80">{i.custo}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
