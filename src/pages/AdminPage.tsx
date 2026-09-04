import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { auth, authErrorMessage, firebaseConfigured, signInGM, signOutToAnonymous } from '../firebase'
import {
  countTableContents,
  deleteTableCompletely,
  isSuperAdmin,
  listenAllTables,
  updateTable,
} from '../lib/store'
import type { GameTable } from '../types'

type Access = 'checking' | 'anonymous' | 'denied' | 'granted'

/**
 * Painel do super administrador: uma porta separada do jogo, para olhar e
 * cuidar de todas as mesas do sistema. O acesso é decidido pelo Firestore
 * (documento em /superAdmins), não por este componente — a tela só reflete o
 * que as regras já garantem no servidor.
 */
export function AdminPage() {
  const [access, setAccess] = useState<Access>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Reavalia o crachá sempre que a sessão do Firebase mudar.
  useEffect(() => {
    if (!auth) return
    return auth.onAuthStateChanged(async (user) => {
      if (!user || user.isAnonymous) {
        setAccess('anonymous')
        return
      }
      try {
        setAccess((await isSuperAdmin(user.uid)) ? 'granted' : 'denied')
      } catch {
        setAccess('denied')
      }
    })
  }, [])

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const user = await signInGM(email.trim(), password)
      if (!(await isSuperAdmin(user.uid))) {
        setError('Esta conta não tem acesso de administrador.')
        setAccess('denied')
        return
      }
      setAccess('granted')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!firebaseConfigured) {
    return <p className="p-8 text-center text-amber-300">Firebase não configurado. Veja o README.</p>
  }

  if (access === 'granted') return <AdminConsole />

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="mt-10 text-center">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.42em] text-[color:var(--gold-deep)]">
          Área restrita
        </p>
        <h1 className="font-serif text-3xl font-bold uppercase tracking-[0.12em] text-[color:var(--gold-bright)]">
          Administração
        </h1>
        <div className="mx-auto mt-3 flex max-w-[14rem] items-center gap-2">
          <span className="hud-rule h-px flex-1" />
          <span className="rotate-45 border border-[color:var(--gold)] p-[3px]" />
          <span className="hud-rule h-px flex-1" />
        </div>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Entrar</SectionTitle>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button variant="primary" disabled={!email.trim() || !password || busy} onClick={submit}>
          {busy ? 'Verificando...' : 'Entrar'}
        </Button>
        {access === 'denied' && !error && (
          <p className="text-sm text-red-400">Esta conta não tem acesso de administrador.</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Link to="/" className="self-start text-xs text-purple-400 hover:text-[color:var(--gold)]">
          ← voltar ao jogo
        </Link>
      </Card>
    </div>
  )
}

function AdminConsole() {
  const [tables, setTables] = useState<GameTable[]>([])
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(
    () =>
      listenAllTables(
        (t) => {
          setTables(t)
          setLoadError('')
        },
        (e) => setLoadError(e.message),
      ),
    [],
  )

  const term = search.trim().toLowerCase()
  const shown = term
    ? tables.filter(
        (t) =>
          t.id.toLowerCase().includes(term) ||
          t.name.toLowerCase().includes(term) ||
          (t.gmNickname ?? '').toLowerCase().includes(term) ||
          (t.gmEmail ?? '').toLowerCase().includes(term),
      )
    : tables

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-16">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--gold-deep)]">
            Shadowlords — Sistema
          </p>
          <h1 className="font-serif text-2xl font-bold uppercase tracking-[0.1em] text-[color:var(--gold-bright)]">
            Administração
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="border border-[color:var(--gold-deep)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--gold)] hover:border-[color:var(--gold)]"
          >
            Ir para o jogo
          </Link>
          <Button onClick={() => signOutToAnonymous()}>Sair</Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Mesas" value={tables.length} />
        <StatTile label="Mestres" value={new Set(tables.map((t) => t.gmUid)).size} />
        <StatTile label="Com loja aberta" value={tables.filter((t) => t.shopOpen).length} />
      </div>

      {loadError && (
        <Card className="border-red-800/60 p-4 text-sm text-red-300">
          Não foi possível carregar as mesas: {loadError}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Mesas ({shown.length})</SectionTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nome, Mestre ou e-mail"
            className="w-72"
          />
        </div>

        {shown.length === 0 && <p className="text-sm text-purple-300">Nenhuma mesa encontrada.</p>}

        <div className="flex flex-col gap-2">
          {shown.map((t) => (
            <AdminTableRow key={t.id} table={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-purple-400">{label}</p>
      <p className="font-serif text-3xl text-[color:var(--gold-bright)]">{value}</p>
    </Card>
  )
}

function AdminTableRow({ table, open, onToggle }: { table: GameTable; open: boolean; onToggle: () => void }) {
  const [counts, setCounts] = useState<{ characters: number; npcs: number; log: number } | null>(null)
  const [nameDraft, setNameDraft] = useState(table.name)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!open || counts) return
    let alive = true
    countTableContents(table.id)
      .then((c) => alive && setCounts(c))
      .catch(() => alive && setCounts({ characters: 0, npcs: 0, log: 0 }))
    return () => {
      alive = false
    }
  }, [open, counts, table.id])

  async function remove() {
    const typed = prompt(`Apagar a mesa "${table.name}" (${table.id}) e TUDO nela?\nDigite o código ${table.id} para confirmar:`)
    if (typed?.trim().toUpperCase() !== table.id) return
    setBusy(true)
    setFeedback('')
    try {
      await deleteTableCompletely(table.id)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao apagar a mesa.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-[color:var(--gold-dark)] bg-black/20">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-3">
          <span className="font-serif text-sm tracking-[0.2em] text-[color:var(--gold)]">{table.id}</span>
          <span className="text-sm text-purple-100">{table.name}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-purple-300">
          <span>{table.gmNickname}</span>
          {table.gmEmail && <span className="text-purple-400">{table.gmEmail}</span>}
          <span>{new Date(table.createdAt).toLocaleDateString('pt-BR')}</span>
          {table.shopOpen && <Badge tone="good">loja</Badge>}
          <span className="text-[color:var(--gold)]">{open ? '−' : '+'}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-[color:var(--gold-dark)] p-3">
          <div className="flex flex-wrap gap-4 text-xs text-purple-200">
            <span>Personagens: <b className="text-[color:var(--gold)]">{counts?.characters ?? '...'}</b></span>
            <span>Criaturas: <b className="text-[color:var(--gold)]">{counts?.npcs ?? '...'}</b></span>
            <span>Eventos no log: <b className="text-[color:var(--gold)]">{counts?.log ?? '...'}</b></span>
            <span>Criada em {new Date(table.createdAt).toLocaleString('pt-BR')}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-64" />
            <Button
              disabled={busy || !nameDraft.trim() || nameDraft === table.name}
              onClick={async () => {
                setBusy(true)
                try {
                  await updateTable(table.id, { name: nameDraft.trim() })
                  setFeedback('Nome atualizado.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Renomear
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-purple-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={table.shopOpen}
                onChange={(e) => updateTable(table.id, { shopOpen: e.target.checked })}
              />
              Loja aberta
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={table.requireApproval}
                onChange={(e) => updateTable(table.id, { requireApproval: e.target.checked })}
              />
              Exigir aprovação de rolagens
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--gold-dark)] pt-3">
            <Link
              to={`/t/${table.id}`}
              target="_blank"
              className="border border-[color:var(--gold-deep)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--gold)] hover:border-[color:var(--gold)]"
            >
              Abrir mesa
            </Link>
            <Link
              to={`/t/${table.id}/tela`}
              target="_blank"
              className="border border-[color:var(--gold-deep)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--gold)] hover:border-[color:var(--gold)]"
            >
              Tela de jogo
            </Link>
            <Button variant="danger" disabled={busy} onClick={remove}>
              Apagar mesa
            </Button>
            {feedback && <span className="text-xs text-purple-300">{feedback}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
