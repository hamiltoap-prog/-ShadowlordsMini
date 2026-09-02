import { useEffect, useState } from 'react'
import { approveRollRequest, denyRollRequest } from '../lib/rollFlow'
import { deleteRollRequest, listenRollRequests } from '../lib/store'
import type { Character, GameTable, RollRequest } from '../types'
import { Badge, Button, Card, Input, SectionTitle } from './ui'

/** Fila de pedidos de rolagem aguardando a liberação do Mestre. */
export function ApprovalPanel({ table, characters }: { table: GameTable; characters: Character[] }) {
  const [requests, setRequests] = useState<RollRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => listenRollRequests(table.id, setRequests), [table.id])

  const pending = requests.filter((r) => r.status === 'pending')
  const resolved = requests.filter((r) => r.status !== 'pending').slice(0, 6)

  async function approve(req: RollRequest) {
    const character = characters.find((c) => c.id === req.characterId)
    if (!character) return
    setBusyId(req.id)
    try {
      await approveRollRequest(table, req, character)
    } finally {
      setBusyId(null)
    }
  }

  async function deny(req: RollRequest) {
    setBusyId(req.id)
    try {
      await denyRollRequest(table, req, reason.trim() || undefined)
      setReason('')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Pedidos de Rolagem</SectionTitle>
        {pending.length > 0 ? <Badge tone="bad">{pending.length} aguardando</Badge> : <Badge tone="good">tudo em dia</Badge>}
      </div>

      {pending.length === 0 && <p className="text-sm text-purple-300/50">Nenhum pedido pendente.</p>}

      {pending.map((req) => (
        <div key={req.id} className="animate-pulse-ring rounded-lg border border-amber-700/50 bg-amber-950/20 p-3">
          <p className="text-sm text-amber-100">
            <b>{req.characterName}</b> quer: {req.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={busyId === req.id} onClick={() => approve(req)}>
              ✔ Liberar rolagem
            </Button>
            <Button variant="danger" disabled={busyId === req.id} onClick={() => deny(req)}>
              ✖ Negar
            </Button>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="w-48"
            />
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-purple-900/30 pt-2">
          <p className="text-xs uppercase text-purple-400/60">Últimos resolvidos</p>
          {resolved.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs text-purple-300/70">
              <span>
                {r.status === 'approved' ? '✔' : '✖'} {r.characterName}: {r.resultSummary ?? r.description}
              </span>
              <button className="text-purple-500 hover:text-purple-300" onClick={() => deleteRollRequest(table.id, r.id)}>
                limpar
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
