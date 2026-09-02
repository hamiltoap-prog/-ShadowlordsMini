import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Character, GameTable, LogEntry, NPC, RollRequest, Scene } from '../types'
import { newId, newTableCode } from './id'

function requireDb() {
  if (!db) throw new Error('Firebase não configurado. Confira o arquivo .env (veja .env.example).')
  return db
}

/** Firestore rejeita valores `undefined`. Campos opcionais (ex: characterId,
 * note) às vezes chegam como `undefined` em vez de simplesmente ausentes —
 * removemos essas chaves recursivamente antes de qualquer escrita. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

// ---------- Mesas ----------

export async function createTable(
  gmNickname: string,
  gmUid: string,
  name: string,
  gmEmail?: string,
): Promise<GameTable> {
  const database = requireDb()
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newTableCode()
    const ref = doc(database, 'tables', code)
    const existing = await getDoc(ref)
    if (existing.exists()) continue
    const table: GameTable = {
      id: code,
      code,
      name: name || `Mesa de ${gmNickname}`,
      gmUid,
      gmNickname,
      gmEmail,
      createdAt: Date.now(),
      combatActive: false,
      combatOrder: [],
      combatTurnIndex: 0,
      shopOpen: false,
      requireApproval: true,
    }
    await setDoc(ref, stripUndefined(table))
    return table
  }
  throw new Error('Não foi possível gerar um código de mesa único. Tente novamente.')
}

export async function getTableByCode(code: string): Promise<GameTable | null> {
  const database = requireDb()
  const ref = doc(database, 'tables', code.trim().toUpperCase())
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as GameTable) : null
}

export function listenTable(tableId: string, cb: (t: GameTable | null) => void) {
  const database = requireDb()
  return onSnapshot(doc(database, 'tables', tableId), (snap) => {
    cb(snap.exists() ? (snap.data() as GameTable) : null)
  })
}

export async function updateTable(tableId: string, patch: Partial<GameTable>) {
  const database = requireDb()
  await updateDoc(doc(database, 'tables', tableId), stripUndefined(patch))
}

export interface GMTableRef {
  tableId: string
  name: string
  createdAt: number
}

function gmTablesCol(gmUid: string) {
  return collection(requireDb(), 'gmTables', gmUid, 'tables')
}

/** Registra a mesa no índice particular do Mestre, para ele reencontrá-la
 * ao entrar de outro dispositivo com e-mail e senha. */
export async function indexTableForGM(gmUid: string, table: GameTable) {
  await setDoc(doc(gmTablesCol(gmUid), table.id), {
    tableId: table.id,
    name: table.name,
    createdAt: table.createdAt,
  })
}

/** Mesas em que este uid é o Mestre — usado no login do Mestre por e-mail. */
export async function findTablesForGM(gmUid: string): Promise<GMTableRef[]> {
  const snap = await getDocs(query(gmTablesCol(gmUid), orderBy('createdAt', 'desc'), limit(50)))
  return snap.docs.map((d) => d.data() as GMTableRef)
}

// ---------- Personagens ----------

export function charactersCol(tableId: string) {
  return collection(requireDb(), 'tables', tableId, 'characters')
}

export async function createCharacter(tableId: string, character: Omit<Character, 'id'>): Promise<Character> {
  const id = newId()
  const full: Character = { ...character, id }
  await setDoc(doc(charactersCol(tableId), id), stripUndefined(full))
  return full
}

export async function updateCharacter(tableId: string, characterId: string, patch: Partial<Character>) {
  await updateDoc(doc(charactersCol(tableId), characterId), stripUndefined({ ...patch, updatedAt: Date.now() }))
}

export async function deleteCharacter(tableId: string, characterId: string) {
  await deleteDoc(doc(charactersCol(tableId), characterId))
}

export function listenCharacters(tableId: string, cb: (chars: Character[]) => void) {
  return onSnapshot(query(charactersCol(tableId), orderBy('createdAt', 'asc')), (snap) => {
    cb(snap.docs.map((d) => d.data() as Character))
  })
}

export function listenCharacter(tableId: string, characterId: string, cb: (c: Character | null) => void) {
  return onSnapshot(doc(charactersCol(tableId), characterId), (snap) => {
    cb(snap.exists() ? (snap.data() as Character) : null)
  })
}

export async function findMyCharacter(tableId: string, ownerUid: string): Promise<Character | null> {
  const q = query(charactersCol(tableId), where('ownerUid', '==', ownerUid), limit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : (snap.docs[0].data() as Character)
}

/** Busca um personagem pelo nome (sem diferenciar maiúsculas/acentos de caixa). */
export async function findCharacterByName(tableId: string, name: string): Promise<Character | null> {
  const q = query(charactersCol(tableId), where('nameLower', '==', name.trim().toLowerCase()), limit(1))
  const snap = await getDocs(q)
  return snap.empty ? null : (snap.docs[0].data() as Character)
}

/**
 * "Reivindica" um personagem para o dispositivo atual: o jogador entrou com o
 * código da mesa + nome do personagem, então este navegador passa a controlá-lo.
 */
export async function claimCharacter(tableId: string, characterId: string, ownerUid: string) {
  await updateDoc(doc(charactersCol(tableId), characterId), { ownerUid, updatedAt: Date.now() })
}

// ---------- NPCs / Monstros ----------

export function npcsCol(tableId: string) {
  return collection(requireDb(), 'tables', tableId, 'npcs')
}

export async function createNPC(tableId: string, npc: Omit<NPC, 'id'>): Promise<NPC> {
  const id = newId()
  const full: NPC = { ...npc, id }
  await setDoc(doc(npcsCol(tableId), id), stripUndefined(full))
  return full
}

export async function updateNPC(tableId: string, npcId: string, patch: Partial<NPC>) {
  await updateDoc(doc(npcsCol(tableId), npcId), stripUndefined(patch))
}

export async function deleteNPC(tableId: string, npcId: string) {
  await deleteDoc(doc(npcsCol(tableId), npcId))
}

export function listenNPCs(tableId: string, cb: (npcs: NPC[]) => void) {
  return onSnapshot(query(npcsCol(tableId), orderBy('createdAt', 'asc')), (snap) => {
    cb(snap.docs.map((d) => d.data() as NPC))
  })
}

// ---------- Log de eventos ----------

export function logCol(tableId: string) {
  return collection(requireDb(), 'tables', tableId, 'log')
}

export async function addLogEntry(tableId: string, entry: Omit<LogEntry, 'id' | 'tableId' | 'ts'>) {
  const full: Omit<LogEntry, 'id'> = { ...entry, tableId, ts: Date.now() }
  await addDoc(logCol(tableId), stripUndefined(full))
}

export function listenLog(tableId: string, cb: (entries: LogEntry[]) => void, max = 150) {
  return onSnapshot(query(logCol(tableId), orderBy('ts', 'desc'), limit(max)), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<LogEntry, 'id'>), id: d.id })))
  })
}

// ---------- Rolagens secretas (só o Mestre lê) ----------

export function secretLogCol(tableId: string) {
  return collection(requireDb(), 'tables', tableId, 'secretRolls')
}

export async function addSecretRoll(tableId: string, entry: Omit<LogEntry, 'id' | 'tableId' | 'ts'>) {
  const full: Omit<LogEntry, 'id'> = { ...entry, tableId, ts: Date.now() }
  await addDoc(secretLogCol(tableId), stripUndefined(full))
}

export function listenSecretRolls(tableId: string, cb: (entries: LogEntry[]) => void, max = 50) {
  return onSnapshot(query(secretLogCol(tableId), orderBy('ts', 'desc'), limit(max)), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<LogEntry, 'id'>), id: d.id })))
  })
}

// ---------- Pedidos de rolagem (aprovação do Mestre) ----------

export function rollRequestsCol(tableId: string) {
  return collection(requireDb(), 'tables', tableId, 'rollRequests')
}

export async function createRollRequest(
  tableId: string,
  request: Omit<RollRequest, 'id' | 'tableId' | 'createdAt' | 'status'>,
): Promise<string> {
  const id = newId()
  const full: RollRequest = {
    ...request,
    id,
    tableId,
    status: 'pending',
    createdAt: Date.now(),
  }
  await setDoc(doc(rollRequestsCol(tableId), id), stripUndefined(full))
  return id
}

export async function updateRollRequest(tableId: string, requestId: string, patch: Partial<RollRequest>) {
  await updateDoc(doc(rollRequestsCol(tableId), requestId), stripUndefined(patch))
}

export async function deleteRollRequest(tableId: string, requestId: string) {
  await deleteDoc(doc(rollRequestsCol(tableId), requestId))
}

export function listenRollRequests(tableId: string, cb: (reqs: RollRequest[]) => void, max = 40) {
  return onSnapshot(query(rollRequestsCol(tableId), orderBy('createdAt', 'desc'), limit(max)), (snap) => {
    cb(snap.docs.map((d) => d.data() as RollRequest))
  })
}

export function listenMyRollRequests(tableId: string, characterId: string, cb: (reqs: RollRequest[]) => void) {
  return onSnapshot(
    query(rollRequestsCol(tableId), where('characterId', '==', characterId), orderBy('createdAt', 'desc'), limit(10)),
    (snap) => cb(snap.docs.map((d) => d.data() as RollRequest)),
  )
}

// ---------- Tela de jogo (cena/mapa) ----------

export function sceneDoc(tableId: string) {
  return doc(requireDb(), 'tables', tableId, 'scene', 'current')
}

export async function saveScene(tableId: string, scene: Scene) {
  await setDoc(sceneDoc(tableId), stripUndefined({ ...scene, updatedAt: Date.now() }))
}

export function listenScene(tableId: string, cb: (scene: Scene | null) => void) {
  return onSnapshot(sceneDoc(tableId), (snap) => {
    cb(snap.exists() ? (snap.data() as Scene) : null)
  })
}
