import { useState } from 'react'
import { logNote } from '../lib/actions'
import { updateTable } from '../lib/store'
import type { Character, GameTable, NPC } from '../types'
import { Badge, Button, Card, SectionTitle } from './ui'

function entityInfo(id: string, characters: Character[], npcs: NPC[]) {
  const [kind, refId] = id.split(':')
  if (kind === 'char') {
    const c = characters.find((x) => x.id === refId)
    return c ? { name: c.name, hp: c.hp, defense: c.defense, kind: 'char' as const } : null
  }
  const n = npcs.find((x) => x.id === refId)
  return n ? { name: n.name, hp: n.hp, defense: n.defense, kind: 'npc' as const } : null
}

/** Embaralhamento Fisher-Yates: cada permutação com a mesma chance. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function CombatTracker({ table, characters, npcs }: { table: GameTable; characters: Character[]; npcs: NPC[] }) {
  const order = table.combatOrder
  const [picked, setPicked] = useState<string[]>([])
  const actor = { tableId: table.id, actorName: 'Mestre', actorType: 'gm' as const }

  const available = [
    ...characters.map((c) => ({ id: `char:${c.id}`, name: c.name })),
    ...npcs.map((n) => ({ id: `npc:${n.id}`, name: n.name })),
  ].filter((e) => !order.includes(e.id))

  // A marcação é só do navegador do Mestre; quem entra na ordem sai dela.
  const selected = picked.filter((id) => available.some((e) => e.id === id))

  function togglePick(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function addToCombat(id: string) {
    setPicked((prev) => prev.filter((x) => x !== id))
    await updateTable(table.id, { combatOrder: [...order, id] })
  }

  /**
   * Sorteia a ordem só de quem ainda não foi colocado à mão: a ordem que o
   * Mestre já estabeleceu não se mexe, e os sorteados entram depois dela.
   */
  async function drawOrder(ids: string[]) {
    if (ids.length === 0) return
    const drawn = shuffle(ids)
    setPicked([])
    await updateTable(table.id, { combatOrder: [...order, ...drawn] })
    const names = drawn
      .map((id, i) => `${order.length + i + 1}. ${entityInfo(id, characters, npcs)?.name ?? '?'}`)
      .join(' · ')
    await logNote(actor, `🎲 Ordem sorteada — ${names}`, 'table')
  }

  async function removeFromCombat(id: string) {
    const newOrder = order.filter((x) => x !== id)
    await updateTable(table.id, { combatOrder: newOrder, combatTurnIndex: 0 })
  }

  async function move(index: number, dir: -1 | 1) {
    const newOrder = [...order]
    const target = index + dir
    if (target < 0 || target >= newOrder.length) return
    ;[newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]]
    await updateTable(table.id, { combatOrder: newOrder })
  }

  async function startCombat() {
    await updateTable(table.id, { combatActive: true, combatTurnIndex: 0 })
    await logNote(actor, '⚔️ Combate iniciado!', 'table')
    const first = order[0] ? entityInfo(order[0], characters, npcs) : null
    if (first) await logNote(actor, `Turno de ${first.name}`, 'table')
  }

  async function endCombat() {
    await updateTable(table.id, { combatActive: false })
    await logNote(actor, 'Combate encerrado.', 'table')
  }

  async function nextTurn() {
    if (order.length === 0) return
    const nextIndex = (table.combatTurnIndex + 1) % order.length
    await updateTable(table.id, { combatTurnIndex: nextIndex })
    const info = entityInfo(order[nextIndex], characters, npcs)
    if (info) await logNote(actor, `Turno de ${info.name}`, 'table')
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Rastreador de Combate</SectionTitle>
        {table.combatActive ? (
          <Badge tone="bad">Em combate</Badge>
        ) : (
          <Badge>Fora de combate</Badge>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {order.map((id, i) => {
          const info = entityInfo(id, characters, npcs)
          if (!info) return null
          const isTurn = table.combatActive && i === table.combatTurnIndex
          return (
            <div
              key={id}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                isTurn ? 'border-purple-500 bg-purple-900/30' : 'border-purple-900/30 bg-black/20'
              }`}
            >
              <span className="text-purple-100">
                {isTurn && '▶ '}
                {info.name}{' '}
                <span className="text-xs text-purple-300/50">
                  ({info.kind === 'char' ? 'PJ' : 'NPC'} · PV {info.hp.current}/{info.hp.max} · Def {info.defense})
                </span>
              </span>
              <span className="flex gap-1">
                <button className="text-purple-400 hover:text-purple-200" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button className="text-purple-400 hover:text-purple-200" onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button className="text-red-400 hover:text-red-200" onClick={() => removeFromCombat(id)}>
                  remover
                </button>
              </span>
            </div>
          )
        })}
        {order.length === 0 && <p className="text-sm text-purple-300/50">Adicione participantes ao combate.</p>}
      </div>

      {available.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-purple-900/30 pt-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-purple-400/60">
            Fora do combate — marque para sortear a ordem, ou use ＋ para pôr direto no fim
          </p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((e) => {
              const on = selected.includes(e.id)
              return (
                <span
                  key={e.id}
                  className={`flex items-center gap-1 rounded-full border py-1 pl-2 pr-1 text-xs transition ${
                    on
                      ? 'border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-[color:var(--gold-bright)]'
                      : 'border-purple-800/50 text-purple-300/70'
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={on} onChange={() => togglePick(e.id)} className="h-3 w-3" />
                    {e.name}
                  </label>
                  <button
                    title="Adicionar direto no fim da ordem"
                    className="px-1 text-purple-400 hover:text-purple-100"
                    onClick={() => addToCombat(e.id)}
                  >
                    ＋
                  </button>
                </span>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={selected.length === 0} onClick={() => drawOrder(selected)}>
              Sortear selecionados ({selected.length})
            </Button>
            <Button variant="ghost" onClick={() => drawOrder(available.map((e) => e.id))}>
              Sortear todos os restantes
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!table.combatActive ? (
          <Button variant="primary" onClick={startCombat} disabled={order.length === 0}>
            Iniciar Combate
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={nextTurn}>
              Próximo Turno
            </Button>
            <Button variant="danger" onClick={endCombat}>
              Encerrar Combate
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
