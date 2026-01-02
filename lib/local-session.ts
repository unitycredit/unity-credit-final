// Client-only local session helper (no secrets).
// Purpose: keep basic UI state working even when external services are offline.

export type LocalSession = {
  email: string
  user_id?: string
  created_at: string
}

const KEY = 'uc_local_session_v1'

export function getLocalSession(): LocalSession | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const email = String(parsed?.email || '').trim().toLowerCase()
    const user_id = String(parsed?.user_id || '').trim()
    const created_at = String(parsed?.created_at || '').trim()
    if (!email || !email.includes('@')) return null
    return { email, user_id: user_id || undefined, created_at: created_at || new Date().toISOString() }
  } catch {
    return null
  }
}

export function setLocalSession(email: string, user_id?: string) {
  try {
    if (typeof window === 'undefined') return
    const payload: LocalSession = {
      email: String(email || '').trim().toLowerCase(),
      user_id: user_id ? String(user_id).trim() : undefined,
      created_at: new Date().toISOString(),
    }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function clearLocalSession() {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}


