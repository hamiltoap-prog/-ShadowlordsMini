import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionPanel } from '../components/ActionPanel'
import { ConditionsBadges } from '../components/ConditionsBadges'
import { ConditionsEditor } from '../components/ConditionsEditor'
import { DiceOverlay } from '../components/DiceOverlay'
import { FreeDiceRoller } from '../components/FreeDiceRoller'
import { HpDonation } from '../components/HpDonation'
import { LogFeed } from '../components/LogFeed'
import { PortraitEditor } from '../components/PortraitEditor'
import { ShopPanel } from '../components/ShopPanel'
import { XpPanel } from '../components/XpPanel'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { logNote } from '../lib/actions'
import { ancestryTraitLabel } from '../lib/ancestry'
import { totalDefense } from '../lib/characterMath'
import { RARITY_STYLE, toCarriedArmor, toCarriedWeapon, toInventoryItem } from '../lib/items'
import type { ShopEntry } from '../lib/items'
import { listenCharacter, listenCharacters, listenCustomItems, updateCharacter } from '../lib/store'
import { ANCESTRY_LABELS, ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { CarriedItemFlavor, Character, CustomItem, GameTable } from '../types'

/**
 * Ficha do jogador. Quando `asGM` é verdadeiro, o Mestre está controlando a
 * ficha e ganha acesso à edição de atributos, PV máximos, defesa e moedas.
 */
export function PlayerView({
  table,
  characterId,
  uid,
  asGM = false,
}: {
  table: GameTable
  characterId: string
  uid: string
  asGM?: boolean
}) {
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [noteDraft, setNoteDraft] = useState('')
  const [hpDelta, setHpDelta] = useState(1)
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const [tableChars, setTableChars] = useState<Character[]>([])

  useEffect(() => listenCustomItems(table.id, setCustomItems), [table.id])
  useEffect(() => listenCharacters(table.id, setTableChars), [table.id])

  useEffect(() => {
    setCharacter(undefined)
    return listenCharacter(table.id, characterId, (c) => {
      setCharacter(c)
      if (c) {
        setNoteDraft((prev) => (document.activeElement?.id === 'notes-field' ? prev : c.notes))
      }
    })
  }, [table.id, characterId])

  if (character === undefined) {
    return <p className="p-6 text-center text-purple-300/60">Carregando personagem...</p>
  }
  if (character === null) {
    return <p className="p-6 text-center text-red-300">Personagem não encontrado.</p>
  }

  const actor = { tableId: table.id, actorName: character.name, actorType: 'player' as const, characterId: character.id }
  const shopAvailable = table.shopOpen || asGM

  async function applyHp(delta: number) {
    if (!character) return
    const newCurrent = Math.max(0, Math.min(character.hp.max, character.hp.current + delta))
    await updateCharacter(table.id, character.id, {
      hp: { ...character.hp, current: newCurrent },
      isAlive: newCurrent > 0,
    })
    await logNote(actor, `${delta > 0 ? 'recuperou' : 'sofreu'} ${Math.abs(delta)} PV (${newCurrent}/${character.hp.max})`, 'hp')
  }

  async function toggleEquip(kind: 'weapon' | 'armor', id: string) {
    if (!character) return
    if (kind === 'weapon') {
      const weapons = character.weapons.map((w) => (w.id === id ? { ...w, equipped: !w.equipped } : w))
      await updateCharacter(table.id, character.id, { weapons })
    } else {
      const armor = character.armor.map((a) => (a.id === id ? { ...a, equipped: !a.equipped } : a))
      await updateCharacter(table.id, character.id, { armor, defense: totalDefense(character.baseDefense, armor) })
    }
  }

  async function removeItem(kind: 'weapon' | 'armor' | 'equipment', id: string) {
    if (!character) return
    if (kind === 'weapon') {
      await updateCharacter(table.id, character.id, { weapons: character.weapons.filter((w) => w.id !== id) })
    } else if (kind === 'armor') {
      const armor = character.armor.filter((a) => a.id !== id)
      await updateCharacter(table.id, character.id, { armor, defense: totalDefense(character.baseDefense, armor) })
    } else {
      await updateCharacter(table.id, character.id, { equipment: character.equipment.filter((i) => i.id !== id) })
    }
  }

  async function changeQty(id: string, delta: number) {
    if (!character) return
    const equipment = character.equipment
      .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty > 0)
    await updateCharacter(table.id, character.id, { equipment })
  }

  /**
   * Compra na loja. A prateleira já entrega tudo que a peça precisa (inclusive
   * o que o Mestre forjou: mágico, efeitos, bônus), então aqui só sobra pagar e
   * guardar na ficha.
   */
  async function buy(entry: ShopEntry) {
    if (!character || character.gold < entry.custo) return
    if (entry.kind === 'weapon') {
      await updateCharacter(table.id, character.id, {
        gold: character.gold - entry.custo,
        weapons: [...character.weapons, toCarriedWeapon(entry)],
      })
    } else if (entry.kind === 'armor') {
      const armor = [...character.armor, toCarriedArmor(entry)]
      await updateCharacter(table.id, character.id, {
        gold: character.gold - entry.custo,
        armor,
        defense: totalDefense(character.baseDefense, armor),
      })
    } else {
      const existing = character.equipment.find((i) => i.name === entry.name)
      const equipment = existing
        ? character.equipment.map((i) => (i.name === entry.name ? { ...i, qty: i.qty + 1 } : i))
        : [...character.equipment, toInventoryItem(entry)]
      await updateCharacter(table.id, character.id, { gold: character.gold - entry.custo, equipment })
    }
    await logNote(actor, `comprou ${entry.icon ? entry.icon + ' ' : ''}${entry.name} por ${entry.custo} moedas`, 'note')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-16 lg:grid lg:grid-cols-[1fr_340px] lg:items-start">
      {!asGM && <DiceOverlay tableId={table.id} isGM={false} />}

      <div className="flex flex-col gap-4">
        {/* Cabeçalho */}
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <PortraitEditor
                url={character.portraitUrl}
                name={character.name}
                size={64}
                onSave={(url) => updateCharacter(table.id, character.id, { portraitUrl: url || undefined })}
              />
              <div>
                <CharacterName
                  name={character.name}
                  onRename={(name) =>
                    updateCharacter(table.id, character.id, { name, nameLower: name.toLowerCase() })
                  }
                />
                <p className="text-sm text-purple-300/60">
                  {character.ancestry && `${ANCESTRY_LABELS[character.ancestry]} · `}
                  {character.occupation} · {character.origin}
                </p>
                <p className="text-xs text-purple-300/40">Jogador: {character.playerNickname}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!character.isAlive && <Badge tone="bad">Morto</Badge>}
              <Link
                to={`/t/${table.id}/tela`}
                target="_blank"
                className="rounded-lg border border-purple-800/50 px-3 py-1.5 text-sm text-purple-200 hover:border-purple-500"
              >
                🗺️ Abrir tela de jogo
              </Link>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs uppercase text-purple-400/60">Pontos de Vida</p>
              <div className="flex items-center gap-2">
                <div className="h-3 w-40 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={`h-full ${
                      character.hp.current / character.hp.max > 0.5
                        ? 'bg-emerald-600'
                        : character.hp.current / character.hp.max > 0.2
                          ? 'bg-amber-500'
                          : 'bg-red-600'
                    }`}
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
              <HpDonation
                table={table}
                character={character}
                characters={tableChars.filter((c) => c.id !== character.id && c.isAlive)}
              />
            </div>
            <div>
              <p className="text-xs uppercase text-purple-400/60">Defesa</p>
              <p className="text-xl text-purple-100">{character.defense}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-purple-400/60">Moedas</p>
              {asGM ? (
                <Input
                  type="number"
                  value={character.gold}
                  onChange={(e) => updateCharacter(table.id, character.id, { gold: Number(e.target.value) })}
                  className="w-24"
                />
              ) : (
                <p className="text-xl text-amber-300/90">{character.gold}</p>
              )}
            </div>
          </div>

          {(character.ancestry || (character.conditions ?? []).length > 0 || asGM) && (
            <div className="mt-3 flex flex-col gap-2 border-t border-purple-900/30 pt-3">
              {character.ancestry && (
                <p className="text-xs text-purple-300/60">🧬 {ancestryTraitLabel(character)}</p>
              )}
              {character.ancestry === 'halfling' && (
                <HalflingResource table={table} character={character} asGM={asGM} />
              )}
              {asGM ? (
                <ConditionsEditor tableId={table.id} character={character} />
              ) : (
                <ConditionsBadges conditions={character.conditions ?? []} />
              )}
            </div>
          )}
        </Card>

        {/* Atributos */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Atributos</SectionTitle>
            {!asGM && <span className="text-xs text-purple-400/50">só o Mestre pode alterar</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {ATTRIBUTE_KEYS.map((k) => (
              <div key={k} className="rounded-lg border border-purple-900/40 bg-black/20 p-2 text-center">
                <p className="text-[10px] uppercase text-purple-400/60">{ATTRIBUTE_LABELS[k]}</p>
                {asGM ? (
                  <GMAttributeEditor table={table} character={character} attrKey={k} />
                ) : (
                  <>
                    <p className="text-lg text-purple-100">{character.attributes[k].score}</p>
                    <p className="text-xs text-purple-300/60">
                      mod. {character.attributes[k].mod >= 0 ? '+' : ''}
                      {character.attributes[k].mod}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
          {asGM && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-purple-900/30 pt-3 text-sm">
              <label className="flex items-center gap-1 text-purple-300/70">
                PV máx.
                <Input
                  type="number"
                  value={character.hp.max}
                  onChange={(e) =>
                    updateCharacter(table.id, character.id, { hp: { ...character.hp, max: Number(e.target.value) } })
                  }
                  className="w-20"
                />
              </label>
              <label className="flex items-center gap-1 text-purple-300/70">
                Defesa base
                <Input
                  type="number"
                  value={character.baseDefense}
                  onChange={(e) => {
                    const baseDefense = Number(e.target.value)
                    updateCharacter(table.id, character.id, {
                      baseDefense,
                      defense: totalDefense(baseDefense, character.armor),
                    })
                  }}
                  className="w-20"
                />
              </label>
              <label className="flex items-center gap-1 text-purple-300/70">
                XP
                <Input
                  type="number"
                  value={character.xp}
                  onChange={(e) => updateCharacter(table.id, character.id, { xp: Number(e.target.value) })}
                  className="w-20"
                />
              </label>
            </div>
          )}
          {character.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {character.skills.map((s) => (
                <Badge key={s.name}>{s.name}</Badge>
              ))}
            </div>
          )}
        </Card>

        {/* Ações */}
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Ações</SectionTitle>
            {table.requireApproval && !asGM && (
              <span className="text-xs text-purple-400/50">as rolagens passam pelo Mestre</span>
            )}
          </div>
          <ActionPanel table={table} character={character} uid={uid} />
        </Card>

        {/* Rolagem livre — para o que não passa por uma ação da ficha */}
        <Card className="p-4">
          <FreeDiceRoller
            table={table}
            actorName={character.name}
            actorType="player"
            characterId={character.id}
            title="Rolagem Livre"
          />
          <p className="mt-2 text-xs text-purple-300/50">
            Não passa pela aprovação do Mestre — é para sorteios, curiosidades e tabelas da casa.
          </p>
        </Card>

        {/* Loja — aparece com destaque assim que o Mestre libera */}
        <ShopPanel open={shopAvailable} gold={character.gold} customItems={customItems} onBuy={buy} />

        {/* Iluminação */}
        <LightSourceCard table={table} character={character} />

        {/* Inventário */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Inventário</SectionTitle>
            <span className="text-sm text-[color:var(--gold)]">💰 {character.gold}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/60">Armas</p>
              {character.weapons.map((w) => (
                <div key={w.id} className="flex items-start justify-between gap-2 py-0.5 text-sm">
                  <span className={`min-w-0 ${w.equipped ? '' : 'opacity-50'}`}>
                    <span className="flex flex-wrap items-center gap-1">
                      {w.icon && <span>{w.icon}</span>}
                      <span className={`${w.rarity ? RARITY_STYLE[w.rarity] : 'text-purple-100'} ${w.equipped ? '' : 'line-through'}`}>
                        {w.name}
                      </span>
                      <span className="text-purple-300/60">
                        ({w.dano}
                        {w.damageBonus ? `${w.damageBonus > 0 ? '+' : ''}${w.damageBonus}` : ''})
                      </span>
                      {w.magical && <Badge tone="good">mágico</Badge>}
                    </span>
                    <ItemFlavor item={w} />
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
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-purple-400/60">Armaduras</p>
              {character.armor.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 py-0.5 text-sm">
                  <span className={`min-w-0 ${a.equipped ? '' : 'opacity-50'}`}>
                    <span className="flex flex-wrap items-center gap-1">
                      {a.icon && <span>{a.icon}</span>}
                      <span className={`${a.rarity ? RARITY_STYLE[a.rarity] : 'text-purple-100'} ${a.equipped ? '' : 'line-through'}`}>
                        {a.name}
                      </span>
                      <span className="text-purple-300/60">(+{a.defesaBonus})</span>
                      {a.magical && <Badge tone="good">mágico</Badge>}
                    </span>
                    <ItemFlavor item={a} />
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
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs uppercase text-purple-400/60">Equipamento</p>
            {character.equipment.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-2 py-0.5 text-sm">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1">
                    {i.icon && <span>{i.icon}</span>}
                    <span className={i.rarity ? RARITY_STYLE[i.rarity] : 'text-purple-100'}>{i.name}</span>
                    {i.magical && <Badge tone="good">mágico</Badge>}
                    {i.charges ? <span className="text-xs text-purple-300/50">{i.charges} cargas</span> : null}
                  </span>
                  <ItemFlavor item={i} />
                </span>
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
          </div>

        </Card>

        {/* XP */}
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

        {/* Anotações */}
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Anotações</SectionTitle>
          <textarea
            id="notes-field"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => updateCharacter(table.id, character.id, { notes: noteDraft })}
            rows={4}
            className="w-full rounded-lg border border-purple-900/50 bg-[var(--surface-well)] p-2 text-sm text-purple-50 outline-none focus:border-purple-500"
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

/**
 * Nome do personagem, editável no lugar.
 *
 * O `nameLower` anda junto porque é por ele que o jogador reencontra a ficha ao
 * entrar de outro aparelho — deixar os dois fora de sincronia perderia o acesso.
 */
function CharacterName({ name, onRename }: { name: string; onRename: (name: string) => Promise<void> | void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  async function save() {
    const clean = draft.trim()
    if (clean && clean !== name) await onRename(clean)
    setEditing(false)
  }

  if (!editing) {
    return (
      <h1 data-character-name="" className="group flex items-center gap-2 font-serif text-2xl text-purple-100">
        {name}
        <button
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
          title="Mudar o nome do personagem"
          className="text-xs text-purple-400 opacity-0 transition hover:text-[color:var(--gold-bright)] group-hover:opacity-100"
        >
          ✎
        </button>
      </h1>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        data-rename-input=""
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-48"
      />
      <Button variant="primary" className="text-xs" disabled={!draft.trim()} onClick={save}>
        Salvar
      </Button>
      <button className="text-xs text-purple-400 hover:text-purple-100" onClick={() => setEditing(false)}>
        cancelar
      </button>
    </div>
  )
}

/** Linha de apoio de um item: descrição e efeitos, quando o item tem. */
function ItemFlavor({ item }: { item: CarriedItemFlavor }) {
  if (!item.description && !item.effectNote) return null
  return (
    <span className="block text-[11px] leading-snug text-purple-400/60">
      {item.effectNote && <span className="text-[color:var(--gold)]/80">✦ {item.effectNote}</span>}
      {item.effectNote && item.description && ' · '}
      {item.description}
    </span>
  )
}

/** Fonte de luz do personagem: contador em tempo real (padrão 1h), ilumina o
 * token na tela de jogo enquanto durar. O Mestre também pode apagar. */
function LightSourceCard({ table, character }: { table: GameTable; character: Character }) {
  const [minutes, setMinutes] = useState(60)
  const [now, setNow] = useState(Date.now())
  const active = Boolean(character.lightUntil && character.lightUntil > now)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  async function light() {
    await updateCharacter(table.id, character.id, { lightUntil: Date.now() + Math.max(1, minutes) * 60000 })
  }

  async function extinguish() {
    // 0 (não undefined) para de fato zerar o campo — updateCharacter descarta
    // chaves undefined antes de escrever no Firestore.
    await updateCharacter(table.id, character.id, { lightUntil: 0 })
  }

  const remainingMs = Math.max(0, (character.lightUntil ?? 0) - now)
  const remainingMin = Math.floor(remainingMs / 60000)
  const remainingSec = Math.floor((remainingMs % 60000) / 1000)

  return (
    <Card className="flex flex-col gap-2 p-4">
      <SectionTitle>🔥 Iluminação</SectionTitle>
      {active ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="good">
            Acesa — {remainingMin}:{String(remainingSec).padStart(2, '0')} restantes
          </Badge>
          <Button variant="danger" onClick={extinguish}>
            Apagar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-purple-300/70">Duração (minutos):</span>
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            className="w-20"
          />
          <Button variant="primary" onClick={light}>
            🔥 Acender
          </Button>
          <span className="text-xs text-purple-300/50">padrão: 60 min — ilumina ao redor do personagem na tela de jogo</span>
        </div>
      )}
    </Card>
  )
}

function HalflingResource({ table, character, asGM }: { table: GameTable; character: Character; asGM: boolean }) {
  const used = character.racialResourceUsed ?? 0
  const available = used < 1
  const actor = { tableId: table.id, actorName: character.name, actorType: 'player' as const, characterId: character.id }

  async function use() {
    await updateCharacter(table.id, character.id, { racialResourceUsed: used + 1 })
    await logNote(actor, 'usou Furtivo — ficou invisível por 3 rodadas', 'note')
  }

  async function reset() {
    await updateCharacter(table.id, character.id, { racialResourceUsed: 0 })
  }

  return (
    <div className="flex items-center gap-2 text-xs text-purple-300/70">
      <span>Furtivo (Halfling): {available ? 'disponível hoje' : 'já usado hoje'}</span>
      {available && (
        <Button onClick={use} className="px-2 py-0.5 text-xs">
          Usar (invisível 3 rodadas)
        </Button>
      )}
      {asGM && !available && (
        <button className="text-purple-400 hover:text-purple-200" onClick={reset}>
          resetar (novo dia)
        </button>
      )}
    </div>
  )
}

function GMAttributeEditor({
  table,
  character,
  attrKey,
}: {
  table: GameTable
  character: Character
  attrKey: (typeof ATTRIBUTE_KEYS)[number]
}) {
  const attr = character.attributes[attrKey]
  function update(patch: { score?: number; mod?: number }) {
    updateCharacter(table.id, character.id, {
      attributes: { ...character.attributes, [attrKey]: { ...attr, ...patch } },
    })
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <Input
        type="number"
        value={attr.score}
        onChange={(e) => update({ score: Number(e.target.value) })}
        className="w-14 px-1 text-center"
      />
      <Input
        type="number"
        value={attr.mod}
        onChange={(e) => update({ mod: Number(e.target.value) })}
        className="w-14 px-1 text-center text-xs"
      />
    </div>
  )
}

