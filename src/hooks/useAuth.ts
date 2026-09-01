import { useEffect, useState } from 'react'
import { authReady, firebaseConfigured, initAuth } from '../firebase'

let started = false

export function useAuthUid() {
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseConfigured) return
    if (!started) {
      started = true
      initAuth()
    }
    let cancelled = false
    authReady.then((user) => {
      if (!cancelled) setUid(user.uid)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return uid
}
