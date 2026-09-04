import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApprovalPanel } from '../components/ApprovalPanel'
import { CombatTracker } from '../components/CombatTracker'
import { DiceOverlay } from '../components/DiceOverlay'
import { GMDiceRoller } from '../components/GMDiceRoller'
import { LogFeed } from '../components/LogFeed'
import { NpcManager } from '../components/NpcManager'
import { Portrait } from '../components/Portrait'
import { ReferenceBrowser } from '../components/ReferenceBrowser'
import { Badge, Button, Card, Input, SectionTitle, TabButton } from '../components/ui'
import { authErrorMessage, changeGMPassword } from '../firebase'
import { deleteCharacter, listenCharacters, listenNPCs, listenRollRequests, updateTable } from '../lib/store'
import type { Character, GameTable, NPC } from '../types'
import { CharacterCreate } from './CharacterCreate'
import { PlayerView } from './PlayerView'

type Tab = 'mesa' | 'personagens' | 'npcs' | 'combate' | 'tabelas' | 'config'

export function GMDashboard({ table }: { table: GameTable }) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [tab, setTab] = useState<Tab>('mesa')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [creatingChar, setCreatingChar] = useState(false)

  useEffect(() => listenCharacters(table.id, setCharacters), [table.id])
  useEffect(() => listenNPCs(table.id, setNpcs), [table.id])
  useEffect(
    () => listenRollRequests(table.id, (reqs) => setPendingCount(reqs.filter((r) => r.status === 'pending').length)),
    [table.id],
  )

  const selected = characters.find((c) => c.id === selectedId) ?? null
  // Personagens criados pelo próprio Mestre (aliados, vilões, substitutos) contam
  // como NPCs e aparecem junto com as outras criaturas, não com os jogadores.
  const players = characters.filter((c) => c.ownerUid !== table.gmUid)
  const gmCharacters = characters.filter((c) => c.ownerUid === table.gmUid)

  function copyCode() {
    navigator.clipboard?.writeText(table.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-16">
      <DiceOverlay tableId={table.id} isGM />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="font-serif text-2xl text-purple-100">{table.name}</h1>
          <p className="text-sm text-purple-300/60">Mestre: {table.gmNickname}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/t/${table.id}/tela`}
            target="_blank"
            className="rounded-lg border border-purple-700/50 bg-purple-950/40 px-3 py-1.5 text-sm text-purple-100 hover:border-purple-500"
          >
            🗺️ Tela de jogo
          </Link>
          <button
            onClick={copyCode}
            className="rounded-lg border border-purple-700/50 bg-purple-950/40 px-3 py-1.5 text-sm text-purple-100"
          >
            Código: <b className="tracking-widest">{table.code}</b> {copied ? '✓' : '⧉'}
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-[color:var(--gold-dark)]">
        {(
          [
            ['mesa', `Mesa${pendingCount > 0 ? ` (${pendingCount}!)` : ''}`],
            ['personagens', `Personagens (${players.length})`],
            ['npcs', `NPCs (${gmCharacters.length + npcs.length})`],
            ['combate', 'Combate'],
            ['tabelas', 'Tabelas & Referência'],
            ['config', 'Configurações'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <TabButton
            key={key}
            active={tab === key}
            onClick={() => setTab(key)}
            className={key === 'mesa' && pendingCount > 0 && tab !== 'mesa' ? 'text-amber-300' : ''}
          >
            {label}
          </TabButton>
        ))}
      </div>

      {tab === 'mesa' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <ApprovalPanel table={table} characters={characters} />
            <GMDiceRoller table={table} />
            <Card className="flex flex-col gap-2 p-4">
              <SectionTitle>Controles Rápidos</SectionTitle>
              <label className="flex items-center gap-2 text-sm text-purple-200">
                <input
                  type="checkbox"
                  checked={table.shopOpen}
                  onChange={(e) => updateTable(table.id, { shopOpen: e.target.checked })}
                />
                Loja aberta — jogadores podem comprar armas, armaduras e itens
              </label>
              <label className="flex items-center gap-2 text-sm text-purple-200">
                <input
                  type="checkbox"
                  checked={table.requireApproval}
                  onChange={(e) => updateTable(table.id, { requireApproval: e.target.checked })}
                />
                Exigir minha aprovação para cada rolagem dos jogadores
              </label>
            </Card>
            <Card className="p-4">
              <SectionTitle className="mb-2">Personagens</SectionTitle>
              <div className="flex flex-col gap-1.5">
                {players.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-purple-900/30 bg-black/20 p-2">
                    <Portrait url={c.portraitUrl} name={c.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-purple-100">
                        {c.name} {!c.isAlive && <Badge tone="bad">morto</Badge>}
                      </p>
                      <p className="text-xs text-purple-300/50">
                        PV {c.hp.current}/{c.hp.max} · Def {c.defense} · {c.gold} moedas
                      </p>
                    </div>
                    <button
                      className="text-xs text-purple-400 hover:text-purple-200"
                      onClick={() => {
                        setSelectedId(c.id)
                        setTab('personagens')
                      }}
                    >
                      abrir ficha
                    </button>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-purple-300/50">
                    Nenhum jogador entrou ainda. Compartilhe o código <b>{table.code}</b>.
                  </p>
                )}
              </div>
            </Card>
          </div>
          <LogFeed tableId={table.id} />
        </div>
      )}

      {tab === 'personagens' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {players.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id)
                  setCreatingChar(false)
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                  selected?.id === c.id && !creatingChar
                    ? 'border-purple-500 bg-purple-900/30'
                    : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
                }`}
              >
                <Portrait url={c.portraitUrl} name={c.name} size={32} />
                <span>
                  <span className="block text-purple-100">{c.name}</span>
                  <span className="block text-xs text-purple-300/50">
                    {c.playerNickname} · PV {c.hp.current}/{c.hp.max}
                  </span>
                </span>
              </button>
            ))}
            {players.length === 0 && <p className="text-sm text-purple-300/50">Nenhum jogador entrou ainda.</p>}
          </div>

          {selected && players.some((c) => c.id === selected.id) && (
            <div className="rounded-xl border border-purple-800/40">
              <p className="px-4 pt-3 text-xs uppercase tracking-wide text-purple-400/60">
                Controlando a ficha de {selected.name} como Mestre — você pode editar atributos, PV, defesa e moedas.
              </p>
              <PlayerView table={table} characterId={selected.id} uid={table.gmUid} asGM />
            </div>
          )}
        </div>
      )}

      {tab === 'npcs' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div>
              <SectionTitle>🧙 NPCs</SectionTitle>
              <p className="mt-0.5 text-xs text-purple-300/50">
                Personagens com ficha completa controlados por você — aliados, vilões ou substitutos para um jogador
                ausente. Aparecem aqui automaticamente, prontos para ir à bandeja da tela de jogo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {gmCharacters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    setCreatingChar(false)
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    selected?.id === c.id && !creatingChar
                      ? 'border-purple-500 bg-purple-900/30'
                      : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
                  }`}
                >
                  <Portrait url={c.portraitUrl} name={c.name} size={32} />
                  <span>
                    <span className="block text-purple-100">{c.name}</span>
                    <span className="block text-xs text-purple-300/50">
                      PV {c.hp.current}/{c.hp.max} · Def {c.defense}
                    </span>
                  </span>
                </button>
              ))}
              {gmCharacters.length === 0 && <p className="text-sm text-purple-300/50">Nenhum NPC de ficha completa ainda.</p>}
              <button
                onClick={() => setCreatingChar(true)}
                className={`rounded-lg border border-dashed px-3 py-2 text-sm ${
                  creatingChar
                    ? 'border-purple-500 bg-purple-900/30 text-purple-100'
                    : 'border-purple-800/50 text-purple-300/70 hover:border-purple-500'
                }`}
              >
                + Criar NPC (ficha completa)
              </button>
            </div>

            {creatingChar && (
              <div className="rounded-xl border border-purple-800/40">
                <p className="px-4 pt-3 text-xs uppercase tracking-wide text-purple-400/60">
                  Criando um NPC de ficha completa controlado pelo Mestre (aliado, vilão ou substituto).
                </p>
                <CharacterCreate
                  table={table}
                  uid={table.gmUid}
                  nickname="Mestre"
                  onCreated={(c) => {
                    setSelectedId(c.id)
                    setCreatingChar(false)
                  }}
                />
              </div>
            )}

            {!creatingChar && selected && gmCharacters.some((c) => c.id === selected.id) && (
              <div className="rounded-xl border border-purple-800/40">
                <div className="flex items-center justify-between gap-2 px-4 pt-3">
                  <p className="text-xs uppercase tracking-wide text-purple-400/60">
                    Controlando a ficha de {selected.name} como Mestre.
                  </p>
                  <button
                    className="text-xs text-red-400 hover:text-red-200"
                    onClick={() => {
                      if (confirm(`Remover ${selected.name} da mesa? Isso apaga o NPC.`)) {
                        deleteCharacter(table.id, selected.id)
                        setSelectedId(null)
                      }
                    }}
                  >
                    remover NPC
                  </button>
                </div>
                <PlayerView table={table} characterId={selected.id} uid={table.gmUid} asGM />
              </div>
            )}
          </div>

          <div className="border-t border-purple-900/30 pt-4">
            <NpcManager table={table} npcs={npcs} characters={characters} />
          </div>
        </div>
      )}
      {tab === 'combate' && <CombatTracker table={table} characters={characters} npcs={npcs} />}
      {tab === 'tabelas' && <ReferenceBrowser table={table} actorName={table.gmNickname} />}
      {tab === 'config' && <TableSettings table={table} />}
    </div>
  )
}

function TableSettings({ table }: { table: GameTable }) {
  const [nameDraft, setNameDraft] = useState(table.name)
  const [newPassword, setNewPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function savePassword() {
    setError('')
    setFeedback('')
    try {
      await changeGMPassword(newPassword)
      setNewPassword('')
      setFeedback('Senha atualizada!')
    } catch (err) {
      setError(authErrorMessage(err))
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <SectionTitle>Nome da Mesa</SectionTitle>
        <div className="mt-2 flex items-center gap-2">
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-64" />
          <Button onClick={() => updateTable(table.id, { name: nameDraft })}>Salvar</Button>
        </div>
      </div>

      <div className="border-t border-purple-900/30 pt-3">
        <SectionTitle>Acesso do Mestre</SectionTitle>
        <p className="mt-1 text-sm text-purple-300/60">
          Você entra nesta mesa de qualquer computador com o e-mail{' '}
          <b className="text-purple-200">{table.gmEmail ?? '(não definido)'}</b> e sua senha. Esqueceu a senha? Use
          "Esqueci minha senha" na tela inicial para receber um link por e-mail.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha (mín. 6 caracteres)"
            className="w-64"
          />
          <Button disabled={newPassword.length < 6} onClick={savePassword}>
            Trocar senha
          </Button>
        </div>
        {feedback && <p className="mt-1 text-sm text-emerald-300">{feedback}</p>}
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>

      <div className="border-t border-purple-900/30 pt-3">
        <SectionTitle>Convite dos Jogadores</SectionTitle>
        <p className="mt-1 text-sm text-purple-300/60">
          Compartilhe o código <b className="tracking-widest text-purple-200">{table.code}</b> no Discord. Cada jogador
          entra com o código e o nome do personagem — e reencontra a ficha em qualquer aparelho.
        </p>
      </div>
    </Card>
  )
}
