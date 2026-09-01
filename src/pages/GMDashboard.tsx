import { useEffect, useState } from 'react'
import { CombatTracker } from '../components/CombatTracker'
import { LogFeed } from '../components/LogFeed'
import { NpcManager } from '../components/NpcManager'
import { ReferenceBrowser } from '../components/ReferenceBrowser'
import { Badge, Button, Card, Input, SectionTitle } from '../components/ui'
import { deleteCharacter, listenCharacters, listenNPCs, updateTable } from '../lib/store'
import type { Character, GameTable, NPC } from '../types'
import { PlayerView } from './PlayerView'

type Tab = 'personagens' | 'npcs' | 'combate' | 'tabelas' | 'config'

export function GMDashboard({ table }: { table: GameTable }) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [npcs, setNpcs] = useState<NPC[]>([])
  const [tab, setTab] = useState<Tab>('personagens')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState(table.name)
  const [copied, setCopied] = useState(false)

  useEffect(() => listenCharacters(table.id, setCharacters), [table.id])
  useEffect(() => listenNPCs(table.id, setNpcs), [table.id])

  const selected = characters.find((c) => c.id === selectedId) ?? characters[0] ?? null

  function copyCode() {
    navigator.clipboard?.writeText(table.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-16">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="font-serif text-2xl text-purple-100">{table.name}</h1>
          <p className="text-sm text-purple-300/60">Mestre: {table.gmNickname}</p>
        </div>
        <button onClick={copyCode} className="rounded-lg border border-purple-700/50 bg-purple-950/40 px-3 py-1.5 text-sm text-purple-100">
          Código da mesa: <b className="tracking-widest">{table.code}</b> {copied ? '✓ copiado' : '⧉'}
        </button>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['personagens', `Personagens (${characters.length})`],
            ['npcs', `NPCs / Monstros (${npcs.length})`],
            ['combate', 'Combate'],
            ['tabelas', 'Tabelas & Referência'],
            ['config', 'Configurações'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? 'bg-purple-700 text-white' : 'bg-[#1a1626] text-purple-300/70 hover:bg-[#241f33]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'personagens' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  selected?.id === c.id ? 'border-purple-500 bg-purple-900/30' : 'border-purple-900/30 bg-black/20 hover:border-purple-700'
                }`}
              >
                <p className="text-purple-100">{c.name}</p>
                <p className="text-xs text-purple-300/50">
                  {c.playerNickname} · PV {c.hp.current}/{c.hp.max} · Def {c.defense}
                  {!c.isAlive && (
                    <>
                      {' '}
                      <Badge tone="bad">morto</Badge>
                    </>
                  )}
                </p>
              </button>
            ))}
            {characters.length === 0 && <p className="text-sm text-purple-300/50">Nenhum jogador entrou ainda. Compartilhe o código da mesa!</p>}
          </div>
          {selected && (
            <div className="rounded-xl border border-purple-800/40">
              <div className="flex items-center justify-between px-4 pt-3">
                <p className="text-xs uppercase tracking-wide text-purple-400/60">
                  Controlando ficha como Mestre — todas as ações abaixo afetam {selected.name} diretamente.
                </p>
                <button
                  className="text-xs text-red-400 hover:text-red-200"
                  onClick={() => {
                    if (confirm(`Remover ${selected.name} da mesa? Isso apaga o personagem.`)) {
                      deleteCharacter(table.id, selected.id)
                      setSelectedId(null)
                    }
                  }}
                >
                  remover personagem
                </button>
              </div>
              <PlayerView table={table} characterId={selected.id} />
            </div>
          )}
        </div>
      )}

      {tab === 'npcs' && <NpcManager table={table} npcs={npcs} characters={characters} />}

      {tab === 'combate' && <CombatTracker table={table} characters={characters} npcs={npcs} />}

      {tab === 'tabelas' && <ReferenceBrowser table={table} actorName={table.gmNickname} />}

      {tab === 'config' && (
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Configurações da Mesa</SectionTitle>
          <div className="flex items-center gap-2">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-64" />
            <Button onClick={() => updateTable(table.id, { name: nameDraft })}>Salvar Nome</Button>
          </div>
          <p className="text-sm text-purple-300/60">
            Compartilhe o código <b className="tracking-widest text-purple-200">{table.code}</b> com seu grupo no Discord para que
            entrem na mesa.
          </p>
        </Card>
      )}

      <LogFeed tableId={table.id} compact />
    </div>
  )
}
