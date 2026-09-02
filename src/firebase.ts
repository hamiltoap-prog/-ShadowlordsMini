import {
  EmailAuthProvider,
  type User,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'

const firebaseConfig = useEmulator
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'localhost',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-shadowlords',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

export const firebaseConfigured = useEmulator || Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const app = firebaseConfigured ? initializeApp(firebaseConfig) : undefined
export const db = app ? getFirestore(app) : undefined
export const auth = app ? getAuth(app) : undefined

if (useEmulator && db && auth) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}

export function initAnonymousAuth() {
  if (!auth) return
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((err) => {
        console.error('Falha ao entrar anonimamente no Firebase', err)
      })
    }
  })
}

function requireAuth() {
  if (!auth) throw new Error('Firebase não configurado. Confira o arquivo .env (veja .env.example).')
  return auth
}

/** Traduz os erros do Firebase Auth para mensagens em português. */
export function authErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/weak-password':
      return 'Senha muito fraca — use pelo menos 6 caracteres.'
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Use a opção de entrar como Mestre.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.'
    case 'auth/operation-not-allowed':
      return 'O login por e-mail/senha não está habilitado no projeto Firebase. Ative o provedor "E-mail/senha" em Authentication > Sign-in method.'
    case 'auth/requires-recent-login':
      return 'Por segurança, entre novamente antes de trocar a senha.'
    default:
      return err instanceof Error ? err.message : 'Erro inesperado ao autenticar.'
  }
}

/**
 * Cria a conta de Mestre. Se a sessão atual for anônima, vincula o e-mail/senha
 * a ela — assim o uid continua o mesmo e as mesas já criadas seguem sendo dele.
 */
export async function registerGM(email: string, password: string): Promise<User> {
  const a = requireAuth()
  const current = a.currentUser
  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password)
    const result = await linkWithCredential(current, credential)
    return result.user
  }
  const result = await createUserWithEmailAndPassword(a, email, password)
  return result.user
}

export async function signInGM(email: string, password: string): Promise<User> {
  const a = requireAuth()
  const result = await signInWithEmailAndPassword(a, email, password)
  return result.user
}

export async function sendGMPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email)
}

export async function changeGMPassword(newPassword: string): Promise<void> {
  const a = requireAuth()
  if (!a.currentUser) throw new Error('Nenhuma sessão ativa.')
  await updatePassword(a.currentUser, newPassword)
}

/** Volta para uma sessão anônima (usado ao sair da conta de Mestre). */
export async function signOutToAnonymous(): Promise<void> {
  const a = requireAuth()
  await a.signOut()
  await signInAnonymously(a)
}
