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

export function CombatTracker({ table, characters, npcs }: { table: GameTable; characters: Character[]; npcs: NPC[] }) {
  const order = table.combatOrder
  const actor = { tableId: table.id, actorName: 'Mestre', actorType: 'gm' as const }

  const available = [
    ...characters.map((c) => ({ id: `char:${c.id}`, name: c.name })),
    ...npcs.map((n) => ({ id: `npc:${n.id}`, name: n.name })),
  ].filter((e) => !order.includes(e.id))

  async function addToCombat(id: string) {
    await updateTable(table.id, { combatOrder: [...order, id] })
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
        <div className="flex flex-wrap gap-1.5 border-t border-purple-900/30 pt-2">
          {available.map((e) => (
            <button
              key={e.id}
              className="rounded-full border border-purple-800/50 px-2 py-1 text-xs text-purple-300/70 hover:border-purple-500"
              onClick={() => addToCombat(e.id)}
            >
              + {e.name}
            </button>
          ))}
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
