import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Input } from '../components/ui'
import { useAuthUid } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { getNickname, rememberTable, setNickname } from '../lib/localMemory'
import { findMyCharacter, listenTable } from '../lib/store'
import type { Character, GameTable } from '../types'
import { CharacterCreate } from './CharacterCreate'
import { GMDashboard } from './GMDashboard'
import { PlayerView } from './PlayerView'

export function TableRoute() {
  const { code = '' } = useParams()
  const tableId = code.toUpperCase()
  const uid = useAuthUid()
  const [table, setTable] = useState<GameTable | null | undefined>(undefined)
  const [nickname, setNicknameState] = useState<string | null>(null)
  const [myCharacter, setMyCharacter] = useState<Character | null | undefined>(undefined)

  useEffect(() => {
    if (!firebaseConfigured) return
    return listenTable(tableId, setTable)
  }, [tableId])

  useEffect(() => {
    setNicknameState(getNickname(tableId))
  }, [tableId])

  const isGM = Boolean(uid && table && table.gmUid === uid)

  useEffect(() => {
    if (!uid || !table || isGM) return
    setMyCharacter(undefined)
    findMyCharacter(tableId, uid).then(setMyCharacter)
  }, [uid, table, tableId, isGM])

  useEffect(() => {
    if (table && nickname) {
      rememberTable({ tableId: table.id, tableName: table.name, nickname, isGM })
    }
  }, [table, nickname, isGM])

  if (!firebaseConfigured) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          Firebase não configurado. Veja o README para configurar o arquivo .env.
        </Card>
      </div>
    )
  }

  if (table === undefined || !uid) {
    return <p className="p-8 text-center text-purple-300/60">Carregando mesa...</p>
  }
  if (table === null) {
    return <p className="p-8 text-center text-red-300">Mesa "{tableId}" não encontrada. Confira o código com o Mestre.</p>
  }

  if (isGM) {
    return <GMDashboard table={table} />
  }

  if (!nickname) {
    return <NicknamePrompt onSubmit={(n) => { setNickname(tableId, n); setNicknameState(n) }} tableName={table.name} />
  }

  if (myCharacter === undefined) {
    return <p className="p-8 text-center text-purple-300/60">Procurando seu personagem...</p>
  }
  if (myCharacter === null) {
    return <CharacterCreate table={table} uid={uid} nickname={nickname} onCreated={setMyCharacter} />
  }
  return <PlayerView table={table} characterId={myCharacter.id} />
}

function NicknamePrompt({ tableName, onSubmit }: { tableName: string; onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="mx-auto max-w-sm p-8">
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-purple-200">
          Entrando na mesa <b>{tableName}</b>. Qual é o seu apelido?
        </p>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Seu apelido" />
        <Button variant="primary" disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
          Continuar
        </Button>
      </Card>
    </div>
  )
}
