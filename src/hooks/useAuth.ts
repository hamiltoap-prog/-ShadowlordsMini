import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseConfigured, initAnonymousAuth } from '../firebase'

let started = false

export interface AuthState {
  uid: string | null
  email: string | null
  isAnonymous: boolean
  loading: boolean
}

/** Observa a sessão do Firebase Auth (anônima para jogadores, e-mail/senha para o Mestre). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ uid: null, email: null, isAnonymous: true, loading: true })

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setState({ uid: null, email: null, isAnonymous: true, loading: false })
      return
    }
    if (!started) {
      started = true
      initAnonymousAuth()
    }
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ uid: user.uid, email: user.email, isAnonymous: user.isAnonymous, loading: false })
      } else {
        setState({ uid: null, email: null, isAnonymous: true, loading: true })
      }
    })
  }, [])

  return state
}

export function useAuthUid(): string | null {
  return useAuth().uid
}
