import { useEffect, useState } from 'react'
import { SPELLS } from '../data/spells'
import { ancestryAttackBonus, ancestryDamageBonus, ancestrySpellBonus } from '../lib/ancestry'
import { requestRoll, spendHpOnRoll } from '../lib/rollFlow'
import { listenMyRollRequests } from '../lib/store'
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from '../types'
import type { AttributeKey, Character, GameTable, RollRequest } from '../types'
import { Badge, Button, Input, Select } from './ui'

type Tab = 'teste' | 'ataque' | 'dano' | 'feitico'

/**
 * Painel de ações do jogador. Toda rolagem vira um pedido ao Mestre quando a
 * mesa exige aprovação — evitando rolagens duplas ou fora de hora.
 */
export function ActionPanel({ table, character, uid }: { table: GameTable; character: Character; uid: string }) {
  const [tab, setTab] = useState<Tab>('teste')
  const [attrKey, setAttrKey] = useState<AttributeKey>('for')
  const [skillName, setSkillName] = useState('')
  const [difficulty, setDifficulty] = useState(13)
  const [targetDefense, setTargetDefense] = useState(10)
  const [spellName, setSpellName] = useState(SPELLS[0].name)
  const [weaponIdx, setWeaponIdx] = useState(0)
  const [damageAttr, setDamageAttr] = useState<AttributeKey | ''>('for')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [myRequests, setMyRequests] = useState<RollRequest[]>([])

  useEffect(() => listenMyRollRequests(table.id, character.id, setMyRequests), [table.id, character.id])

  const skillBonus = skillName ? 1 : 0
  const attrMod = character.attributes[attrKey].mod
  const equipped = character.weapons.filter((w) => w.equipped)
  const weapon = equipped[weaponIdx] ?? equipped[0]
  const spell = SPELLS.find((s) => s.name === spellName) ?? SPELLS[0]
  const raceAttackBonus = ancestryAttackBonus(character, weapon?.habilidade)
  const raceDamageBonus = ancestryDamageBonus(character, weapon?.habilidade)
  const raceSpellBonus = ancestrySpellBonus(character)
  const pending = myRequests.find((r) => r.status === 'pending')
  const lastResolved = myRequests.find((r) => r.status === 'approved' || r.status === 'denied')

  async function send(kind: 'attribute_test' | 'attack' | 'spell' | 'damage') {
    setBusy(true)
    setFeedback('')
    try {
      const skillLabel = skillName ? ` + ${skillName}` : ''
      const raceLabel = (bonus: number) => (bonus ? ' + raça' : '')
      const intent =
        kind === 'attribute_test'
          ? {
              kind,
              description: `Teste de ${ATTRIBUTE_LABELS[attrKey]}${skillLabel} (dif. ${difficulty})`,
              attrKey,
              attrMod,
              skillBonus,
              skillName,
              target: difficulty,
            }
          : kind === 'attack'
            ? {
                kind,
                description: `Ataque com ${weapon?.name ?? 'desarmado'}${skillLabel}${raceLabel(raceAttackBonus)} (Defesa ${targetDefense})`,
                attrKey,
                attrMod: attrMod + raceAttackBonus,
                skillBonus,
                skillName,
                target: targetDefense,
              }
            : kind === 'spell'
              ? {
                  kind,
                  description: `Conjurar ${spell.name} (-${spell.custo} PV, ${ATTRIBUTE_LABELS[attrKey]}${raceLabel(raceSpellBonus)})`,
                  attrKey,
                  attrMod: attrMod + raceSpellBonus,
                  skillBonus,
                  skillName,
                  target: 13,
                  spellName: spell.name,
                  spellCost: spell.custo,
                }
              : {
                  kind,
                  description: `Dano com ${weapon?.name ?? 'desarmado'}${raceLabel(raceDamageBonus)}`,
                  weaponLabel: weapon?.name ?? 'Desarmado',
                  weaponDano: weapon?.dano ?? '1d3',
                  damageAttrMod: (damageAttr ? character.attributes[damageAttr].mod : 0) + raceDamageBonus,
                }
      const { pendingId } = await requestRoll(table, character, uid, intent)
      setFeedback(pendingId ? 'Pedido enviado ao Mestre — aguardando liberação.' : 'Rolagem feita!')
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao enviar o pedido.')
    } finally {
      setBusy(false)
    }
  }

  const canCastSpell = character.hp.current > spell.custo

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['teste', '🎲 Teste'],
            ['ataque', '⚔️ Ataque'],
            ['dano', '💥 Dano'],
            ['feitico', '✨ Feitiçaria'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === key ? 'bg-purple-700 text-white' : 'bg-[var(--surface-tab)] text-purple-300/70 hover:bg-[var(--surface-tab-hover)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-purple-900/40 bg-black/20 p-3">
        {(tab === 'teste' || tab === 'ataque' || tab === 'feitico') && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={attrKey} onChange={(e) => setAttrKey(e.target.value as AttributeKey)} className="w-auto">
              {ATTRIBUTE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ATTRIBUTE_LABELS[k]} ({character.attributes[k].mod >= 0 ? '+' : ''}
                  {character.attributes[k].mod})
                </option>
              ))}
            </Select>
            <Select value={skillName} onChange={(e) => setSkillName(e.target.value)} className="w-auto">
              <option value="">Sem Habilidade</option>
              {character.skills.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} (+1)
                </option>
              ))}
            </Select>
          </div>
        )}

        {tab === 'teste' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-purple-300/70">Dificuldade:</span>
            <Select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="w-auto">
              <option value={13}>13 — Difícil</option>
              <option value={14}>14 — Dificuldade elevada</option>
              <option value={15}>15 — Muito difícil</option>
              <option value={16}>16 — Dificuldade muito elevada</option>
              <option value={17}>17 — Extremamente difícil</option>
              <option value={18}>18 — Dificuldade extremamente elevada</option>
            </Select>
            <Button variant="primary" disabled={busy} onClick={() => send('attribute_test')}>
              Pedir rolagem
            </Button>
          </div>
        )}

        {tab === 'ataque' && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={weaponIdx} onChange={(e) => setWeaponIdx(Number(e.target.value))} className="w-auto">
              {equipped.length === 0 && <option value={0}>Desarmado</option>}
              {equipped.map((w, i) => (
                <option key={w.id} value={i}>
                  {w.name} ({w.dano})
                </option>
              ))}
            </Select>
            <span className="text-sm text-purple-300/70">Defesa do alvo:</span>
            <Input
              type="number"
              value={targetDefense}
              onChange={(e) => setTargetDefense(Number(e.target.value))}
              className="w-16"
            />
            <Button variant="primary" disabled={busy} onClick={() => send('attack')}>
              Pedir ataque
            </Button>
          </div>
        )}

        {tab === 'dano' && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={weaponIdx} onChange={(e) => setWeaponIdx(Number(e.target.value))} className="w-auto">
              {equipped.length === 0 && <option value={0}>Desarmado (1d3)</option>}
              {equipped.map((w, i) => (
                <option key={w.id} value={i}>
                  {w.name} ({w.dano})
                </option>
              ))}
            </Select>
            <Select
              value={damageAttr}
              onChange={(e) => setDamageAttr(e.target.value as AttributeKey | '')}
              className="w-auto"
            >
              <option value="">Sem Modificador</option>
              {ATTRIBUTE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ATTRIBUTE_LABELS[k]} ({character.attributes[k].mod >= 0 ? '+' : ''}
                  {character.attributes[k].mod})
                </option>
              ))}
            </Select>
            <Button variant="danger" disabled={busy} onClick={() => send('damage')}>
              Pedir dano
            </Button>
          </div>
        )}

        {tab === 'feitico' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={spellName} onChange={(e) => setSpellName(e.target.value)} className="w-auto min-w-[12rem]">
                {SPELLS.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (-{s.custo} PV)
                  </option>
                ))}
              </Select>
              <Button variant="primary" disabled={busy || !canCastSpell} onClick={() => send('spell')}>
                Pedir conjuração
              </Button>
            </div>
            <p className="text-xs text-purple-300/60">{spell.efeito}</p>
            {!canCastSpell && <p className="text-xs text-red-400">PV insuficiente para conjurar este feitiço.</p>}
          </div>
        )}

        {feedback && <p className="text-xs text-purple-300/70">{feedback}</p>}
      </div>

      {pending && (
        <div className="animate-pulse-ring rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          ⏳ Aguardando o Mestre liberar: {pending.description}
        </div>
      )}

      {lastResolved && lastResolved.status === 'denied' && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-sm text-red-200">
          ✋ O Mestre não liberou: {lastResolved.description}
          {lastResolved.deniedReason ? ` — ${lastResolved.deniedReason}` : ''}
        </div>
      )}

      {lastResolved &&
        lastResolved.status === 'approved' &&
        lastResolved.success === false &&
        lastResolved.hpSpentAfter === undefined &&
        lastResolved.kind !== 'damage' && (
          <HpBoost table={table} character={character} request={lastResolved} />
        )}
    </div>
  )
}

/** Depois de ver o resultado, o jogador pode gastar PV para alcançar a dificuldade. */
function HpBoost({ table, character, request }: { table: GameTable; character: Character; request: RollRequest }) {
  const [amount, setAmount] = useState(1)
  const [busy, setBusy] = useState(false)
  const maxSpend = Math.max(0, character.hp.current - 1)
  const target = request.target ?? 13
  const missing = target - (request.baseTotal ?? 0)

  if (maxSpend <= 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-800/50 bg-purple-950/20 px-3 py-2 text-sm">
      <span className="text-purple-200">
        Faltaram {missing} ponto{missing > 1 ? 's' : ''}. Gastar PV para virar sucesso?
      </span>
      <Input
        type="number"
        min={1}
        max={maxSpend}
        value={amount}
        onChange={(e) => setAmount(Math.max(1, Math.min(maxSpend, Number(e.target.value))))}
        className="w-16"
      />
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await spendHpOnRoll(table, request, character, amount)
          } finally {
            setBusy(false)
          }
        }}
      >
        Gastar {amount} PV
      </Button>
      <Badge>máx. {maxSpend}</Badge>
    </div>
  )
}
