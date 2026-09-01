import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, SectionTitle } from '../components/ui'
import { useAuthUid } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { getRecentTables, rememberTable, setNickname } from '../lib/localMemory'
import { createTable, getTableByCode } from '../lib/store'

export function Home() {
  const uid = useAuthUid()
  const navigate = useNavigate()
  const recent = getRecentTables()

  const [gmName, setGmName] = useState('')
  const [tableName, setTableName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  async function handleCreate() {
    if (!uid || !gmName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const table = await createTable(gmName.trim(), uid, tableName.trim())
      setNickname(table.id, gmName.trim())
      rememberTable({ tableId: table.id, tableName: table.name, nickname: gmName.trim(), isGM: true })
      navigate(`/t/${table.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar mesa.')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    if (!uid || !joinCode.trim() || !joinName.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const table = await getTableByCode(joinCode.trim())
      if (!table) {
        setJoinError('Mesa não encontrada. Confira o código com o Mestre.')
        return
      }
      setNickname(table.id, joinName.trim())
      rememberTable({ tableId: table.id, tableName: table.name, nickname: joinName.trim(), isGM: table.gmUid === uid })
      navigate(`/t/${table.id}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Erro ao entrar na mesa.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="mt-6 text-center">
        <h1 className="font-serif text-4xl text-purple-100">Shadowlords Mesa</h1>
        <p className="mt-1 text-sm text-purple-300/60">
          Companheiro digital para o RPG <i>Shadowlords™ Mini System™</i> — jogue com seu grupo ao vivo, converse pelo Discord.
        </p>
      </div>

      {!firebaseConfigured && (
        <Card className="border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          Firebase ainda não está configurado neste ambiente. Preencha o arquivo <code className="text-amber-100">.env</code>{' '}
          com as chaves do seu projeto (veja <code className="text-amber-100">.env.example</code> e o README) para criar ou
          entrar em mesas.
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Criar uma Mesa (Mestre)</SectionTitle>
        <Input placeholder="Seu nome (Mestre)" value={gmName} onChange={(e) => setGmName(e.target.value)} />
        <Input placeholder="Nome da mesa (opcional)" value={tableName} onChange={(e) => setTableName(e.target.value)} />
        <Button variant="primary" disabled={!uid || !gmName.trim() || creating} onClick={handleCreate}>
          {creating ? 'Criando...' : 'Criar Mesa'}
        </Button>
        {createError && <p className="text-sm text-red-400">{createError}</p>}
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Entrar em uma Mesa (Jogador)</SectionTitle>
        <Input
          placeholder="Código da mesa"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          className="uppercase tracking-widest"
        />
        <Input placeholder="Seu apelido" value={joinName} onChange={(e) => setJoinName(e.target.value)} />
        <Button variant="primary" disabled={!uid || !joinCode.trim() || !joinName.trim() || joining} onClick={handleJoin}>
          {joining ? 'Entrando...' : 'Entrar na Mesa'}
        </Button>
        {joinError && <p className="text-sm text-red-400">{joinError}</p>}
      </Card>

      {recent.length > 0 && (
        <Card className="flex flex-col gap-2 p-5">
          <SectionTitle>Mesas Recentes</SectionTitle>
          {recent.map((t) => (
            <button
              key={t.tableId}
              onClick={() => navigate(`/t/${t.tableId}`)}
              className="flex items-center justify-between rounded-lg border border-purple-900/40 bg-black/20 px-3 py-2 text-left text-sm hover:border-purple-600"
            >
              <span className="text-purple-100">{t.tableName}</span>
              <span className="text-xs text-purple-300/50">
                {t.isGM ? 'Mestre' : 'Jogador'} · {t.nickname}
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
