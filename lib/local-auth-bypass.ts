// Local-only auth bypass helper (client-safe).
// Goal: allow the UI to function on http://localhost:3002 even when external auth/backends are offline.
//
// IMPORTANT:
// - This is NOT a security boundary. It only changes client-side navigation behavior.
// - Server-side auth/middleware can still enforce real sessions in production.

export function isLocalAuthBypassEnabled(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const host = String(window.location.hostname || '').toLowerCase()
    const port = String(window.location.port || '').trim()
    // Explicitly scope to the requested local dev origin.
    return (host === 'localhost' || host === '127.0.0.1') && port === '3002'
  } catch {
    return false
  }
}

export function getLoginHref(): '/login' | '/dashboard' {
  return isLocalAuthBypassEnabled() ? '/dashboard' : '/login'
}


