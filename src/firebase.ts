import { type User, connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
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

let authReadyResolve: (u: User) => void
export const authReady = new Promise<User>((resolve) => {
  authReadyResolve = resolve
})

export function initAuth() {
  if (!auth) return
  onAuthStateChanged(auth, (user) => {
    if (user) {
      authReadyResolve(user)
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error('Falha ao entrar anonimamente no Firebase', err)
      })
    }
  })
}
