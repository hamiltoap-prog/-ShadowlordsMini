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
import type { Character, GameTable, LogEntry, NPC } from '../types'
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

export async function createTable(gmNickname: string, gmUid: string, name: string): Promise<GameTable> {
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
      createdAt: Date.now(),
      combatActive: false,
      combatOrder: [],
      combatTurnIndex: 0,
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
