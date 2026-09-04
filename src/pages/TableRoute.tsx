import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, Input, SectionTitle } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { firebaseConfigured } from '../firebase'
import { getNickname, rememberTable, setNickname } from '../lib/localMemory'
import { claimCharacter, findCharacterByName, findMyCharacter, listenTable } from '../lib/store'
import type { Character, GameTable } from '../types'
import { CharacterCreate } from './CharacterCreate'
import { GMDashboard } from './GMDashboard'
import { PlayerView } from './PlayerView'

export function TableRoute() {
  const { code = '' } = useParams()
  const tableId = code.toUpperCase()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedName = searchParams.get('personagem') ?? ''
  const { uid, loading: authLoading } = useAuth()

  const [table, setTable] = useState<GameTable | null | undefined>(undefined)
  const [character, setCharacter] = useState<Character | null | undefined>(undefined)
  const [lookupError, setLookupError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!firebaseConfigured) return
    return listenTable(tableId, setTable)
  }, [tableId])

  const isGM = Boolean(uid && table && table.gmUid === uid)
  // A busca da ficha só depende de a mesa *existir* — não do conteúdo dela.
  // Usar o objeto `table` aqui refazia a busca a cada escrita do Mestre (abrir
  // combate, anoitecer, abrir a loja...), o que desmontava a ficha inteira e
  // apagava o estado da tela: aba aberta, alvo escolhido, rascunho de anotação.
  const tableLoaded = Boolean(table)

  /** Descobre qual ficha este jogador controla: pelo nome informado no login,
   * ou pela ficha já vinculada a este dispositivo. */
  const resolveCharacter = useCallback(async () => {
    if (!uid || !tableLoaded || isGM) return
    setCharacter(undefined)
    setLookupError('')
    try {
      if (requestedName.trim()) {
        const byName = await findCharacterByName(tableId, requestedName)
        if (byName) {
          if (byName.ownerUid !== uid) await claimCharacter(tableId, byName.id, uid)
          setNickname(tableId, byName.playerNickname || requestedName)
          setCharacter({ ...byName, ownerUid: uid })
          return
        }
        // Nome informado ainda não existe: segue para a criação com esse nome.
        setCharacter(null)
        return
      }
      const mine = await findMyCharacter(tableId, uid)
      setCharacter(mine)
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Erro ao procurar o personagem.')
      setCharacter(null)
    }
  }, [uid, tableLoaded, isGM, requestedName, tableId])

  useEffect(() => {
    void resolveCharacter()
  }, [resolveCharacter])

  useEffect(() => {
    if (table) {
      rememberTable({
        tableId: table.id,
        tableName: table.name,
        nickname: isGM ? table.gmNickname : getNickname(tableId) || '',
        isGM,
      })
    }
  }, [table, isGM, tableId])

  if (!firebaseConfigured) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Card className="border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          Firebase não configurado. Veja o README para configurar o arquivo .env.
        </Card>
      </div>
    )
  }

  if (table === undefined || authLoading || !uid) {
    return <p className="p-8 text-center text-purple-300/60">Carregando mesa...</p>
  }
  if (table === null) {
    return <p className="p-8 text-center text-red-300">Mesa "{tableId}" não encontrada. Confira o código com o Mestre.</p>
  }

  if (isGM) return <GMDashboard table={table} />

  if (character === undefined) {
    return <p className="p-8 text-center text-purple-300/60">Procurando seu personagem...</p>
  }

  if (character === null) {
    if (creating || requestedName.trim()) {
      return (
        <CharacterCreate
          table={table}
          uid={uid}
          suggestedName={requestedName}
          nickname={getNickname(tableId) || requestedName || 'Jogador'}
          onCreated={(c) => {
            setCharacter(c)
            setCreating(false)
          }}
        />
      )
    }
    return (
      <CharacterChooser
        tableName={table.name}
        error={lookupError}
        onEnterExisting={(name) => setSearchParams({ personagem: name })}
        onCreateNew={() => setCreating(true)}
      />
    )
  }

  return <PlayerView table={table} characterId={character.id} uid={uid} />
}

function CharacterChooser({
  tableName,
  error,
  onEnterExisting,
  onCreateNew,
}: {
  tableName: string
  error?: string
  onEnterExisting: (name: string) => void
  onCreateNew: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div className="mx-auto max-w-sm p-8">
      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Mesa {tableName}</SectionTitle>
        <p className="text-sm text-purple-200">Já tem um personagem aqui? Digite o nome dele para retomar a ficha.</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do personagem" />
        <Button variant="primary" disabled={!name.trim()} onClick={() => onEnterExisting(name.trim())}>
          Entrar com este personagem
        </Button>
        <div className="flex items-center gap-2 text-xs text-purple-400/50">
          <span className="h-px flex-1 bg-purple-900/50" /> ou <span className="h-px flex-1 bg-purple-900/50" />
        </div>
        <Button onClick={onCreateNew}>Criar um personagem novo</Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>
    </div>
  )
}
