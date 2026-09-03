import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Input, SectionTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { authErrorMessage, firebaseConfigured, registerGM, sendGMPasswordReset, signInGM } from '../firebase'
import { getRecentTables, rememberTable, setNickname } from '../lib/localMemory'
import {
  type GMTableRef,
  createTable,
  findTablesForGM,
  getTableByCode,
  indexTableForGM,
} from '../lib/store'

type Mode = 'menu' | 'create' | 'gm' | 'player'

export function Home() {
  const { uid, loading } = useAuth()
  const navigate = useNavigate()
  const recent = getRecentTables()
  const [mode, setMode] = useState<Mode>('menu')

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-6">
      <div className="mt-6 text-center">
        <h1 className="font-serif text-4xl text-purple-100">Shadowlords Mesa</h1>
        <p className="mt-1 text-sm text-purple-300/60">
          Companheiro digital para o RPG <i>Shadowlords™ Mini System™</i> — jogue com seu grupo ao vivo, converse pelo
          Discord.
        </p>
      </div>

      {!firebaseConfigured && (
        <Card className="border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          Firebase ainda não está configurado neste ambiente. Preencha o arquivo <code>.env</code> com as chaves do seu
          projeto (veja <code>.env.example</code> e o README).
        </Card>
      )}

      {mode === 'menu' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MenuCard
            emoji="🎲"
            title="Entrar como Jogador"
            desc="Código da mesa + nome do personagem"
            onClick={() => setMode('player')}
          />
          <MenuCard emoji="🧙" title="Entrar como Mestre" desc="Código da mesa + e-mail e senha" onClick={() => setMode('gm')} />
          <MenuCard emoji="🏰" title="Criar uma Mesa" desc="Comece uma campanha nova" onClick={() => setMode('create')} />
        </div>
      )}

      {mode === 'player' && <PlayerLogin uid={uid} loading={loading} onBack={() => setMode('menu')} navigate={navigate} />}
      {mode === 'gm' && <GMLogin onBack={() => setMode('menu')} navigate={navigate} />}
      {mode === 'create' && <CreateTable uid={uid} onBack={() => setMode('menu')} navigate={navigate} />}

      {mode === 'menu' && recent.length > 0 && (
        <Card className="flex flex-col gap-2 p-5">
          <SectionTitle>Mesas Recentes neste Navegador</SectionTitle>
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

function MenuCard({ emoji, title, desc, onClick }: { emoji: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-purple-900/40 bg-[var(--surface-card)]/80 p-4 text-left transition hover:border-purple-500 hover:bg-[var(--surface-card-hover)]"
    >
      <span className="text-2xl">{emoji}</span>
      <p className="mt-1 font-semibold text-purple-100">{title}</p>
      <p className="text-xs text-purple-300/60">{desc}</p>
    </button>
  )
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="self-start text-xs text-purple-400 hover:text-purple-200">
      ← voltar
    </button>
  )
}

type Navigate = ReturnType<typeof useNavigate>

function PlayerLogin({
  uid,
  loading,
  onBack,
  navigate,
}: {
  uid: string | null
  loading: boolean
  onBack: () => void
  navigate: Navigate
}) {
  const [code, setCode] = useState('')
  const [charName, setCharName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function enter() {
    if (!uid) return
    setBusy(true)
    setError('')
    try {
      const table = await getTableByCode(code)
      if (!table) {
        setError('Mesa não encontrada. Confira o código com o Mestre.')
        return
      }
      const name = charName.trim()
      if (name) setNickname(table.id, name)
      rememberTable({ tableId: table.id, tableName: table.name, nickname: name, isGM: false })
      navigate(`/t/${table.id}${name ? `?personagem=${encodeURIComponent(name)}` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar na mesa.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <BackLink onBack={onBack} />
      <SectionTitle>Entrar como Jogador</SectionTitle>
      <p className="text-xs text-purple-300/60">
        Já tem personagem nesta mesa? Digite o nome dele para continuar de onde parou, em qualquer computador ou celular.
        Se for seu primeiro acesso, deixe o nome em branco (ou digite um nome novo) para criar a ficha.
      </p>
      <Input
        placeholder="Código da mesa"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="uppercase tracking-widest"
      />
      <Input placeholder="Nome do personagem" value={charName} onChange={(e) => setCharName(e.target.value)} />
      <Button variant="primary" disabled={!uid || loading || !code.trim() || busy} onClick={enter}>
        {busy ? 'Entrando...' : 'Entrar na Mesa'}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  )
}

function GMLogin({ onBack, navigate }: { onBack: () => void; navigate: Navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [myTables, setMyTables] = useState<GMTableRef[] | null>(null)

  async function enter() {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const user = await signInGM(email.trim(), password)
      if (code.trim()) {
        const table = await getTableByCode(code)
        if (!table) {
          setError('Mesa não encontrada. Confira o código.')
          return
        }
        if (table.gmUid !== user.uid) {
          setError('Esta conta não é a Mestra desta mesa.')
          return
        }
        rememberTable({ tableId: table.id, tableName: table.name, nickname: table.gmNickname, isGM: true })
        navigate(`/t/${table.id}`)
        return
      }
      const tables = await findTablesForGM(user.uid)
      setMyTables(tables)
      if (tables.length === 0) setInfo('Nenhuma mesa encontrada nesta conta. Digite o código da mesa acima.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Digite seu e-mail para receber o link de redefinição.')
      return
    }
    setError('')
    try {
      await sendGMPasswordReset(email.trim())
      setInfo('Enviamos um link de redefinição de senha para o seu e-mail.')
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <BackLink onBack={onBack} />
      <SectionTitle>Entrar como Mestre</SectionTitle>
      <Input placeholder="E-mail do Mestre" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input
        placeholder="Código da mesa (opcional)"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="uppercase tracking-widest"
      />
      <Button variant="primary" disabled={!email.trim() || !password || busy} onClick={enter}>
        {busy ? 'Entrando...' : 'Entrar como Mestre'}
      </Button>
      <button onClick={resetPassword} className="self-start text-xs text-purple-400 hover:text-purple-200">
        Esqueci minha senha
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-300">{info}</p>}
      {myTables && myTables.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-purple-900/30 pt-3">
          <p className="text-xs uppercase text-purple-400/60">Suas mesas</p>
          {myTables.map((t) => (
            <button
              key={t.tableId}
              onClick={() => navigate(`/t/${t.tableId}`)}
              className="flex items-center justify-between rounded-lg border border-purple-900/40 bg-black/20 px-3 py-2 text-left text-sm hover:border-purple-600"
            >
              <span className="text-purple-100">{t.name}</span>
              <span className="tracking-widest text-purple-300/50">{t.tableId}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

function CreateTable({ uid, onBack, navigate }: { uid: string | null; onBack: () => void; navigate: Navigate }) {
  const [gmName, setGmName] = useState('')
  const [tableName, setTableName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!uid) return
    setBusy(true)
    setError('')
    try {
      // Vincula e-mail/senha à sessão atual (mantendo o mesmo uid), para o
      // Mestre conseguir voltar à mesa de qualquer dispositivo.
      const user = await registerGM(email.trim(), password)
      const table = await createTable(gmName.trim(), user.uid, tableName.trim(), email.trim())
      await indexTableForGM(user.uid, table)
      setNickname(table.id, gmName.trim())
      rememberTable({ tableId: table.id, tableName: table.name, nickname: gmName.trim(), isGM: true })
      navigate(`/t/${table.id}`)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <BackLink onBack={onBack} />
      <SectionTitle>Criar uma Mesa</SectionTitle>
      <p className="text-xs text-purple-300/60">
        O e-mail e a senha são a sua chave de Mestre: com eles você entra na mesa de qualquer computador e pode
        recuperar o acesso caso esqueça a senha.
      </p>
      <Input placeholder="Seu nome (Mestre)" value={gmName} onChange={(e) => setGmName(e.target.value)} />
      <Input placeholder="Nome da mesa (opcional)" value={tableName} onChange={(e) => setTableName(e.target.value)} />
      <Input placeholder="E-mail do Mestre" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input
        placeholder="Senha (mín. 6 caracteres)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        variant="primary"
        disabled={!uid || !gmName.trim() || !email.trim() || password.length < 6 || busy}
        onClick={create}
      >
        {busy ? 'Criando...' : 'Criar Mesa'}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  )
}
