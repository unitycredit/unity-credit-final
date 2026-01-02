import type { NextRequest } from 'next/server'

function isLocalHost(host: string) {
  const h = String(host || '').toLowerCase()
  return h.startsWith('localhost:') || h === 'localhost' || h.startsWith('127.0.0.1:') || h === '127.0.0.1'
}

/**
 * Admin secret resolution:
 * - Production: requires ADMIN_SECRET.
 * - Dev: if ADMIN_SECRET is missing, allow a localhost-only dev PIN (123456) so the hidden Settings PIN works out of the box.
 */
export function resolveAdminSecret(req?: NextRequest | null) {
  const explicit = String(process.env.ADMIN_SECRET || '').trim()
  if (explicit) return { enabled: true, secret: explicit, mode: 'env' as const }

  if (process.env.NODE_ENV === 'production') return { enabled: false, secret: '', mode: 'disabled' as const }

  // Local dev fallback: only when requests originate from localhost.
  const host = req?.headers?.get('host') || ''
  if (req && !isLocalHost(host)) return { enabled: false, secret: '', mode: 'disabled' as const }

  return { enabled: true, secret: '123456', mode: 'dev_pin' as const }
}


