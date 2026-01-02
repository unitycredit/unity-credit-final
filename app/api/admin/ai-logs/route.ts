import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

export const runtime = 'nodejs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Lightweight aggregation endpoint for the Admin Command Center.
 * For full data, use:
 * - /api/admin/unity-brain/interactions
 * - /api/admin/unity-savings-vault
 * - /api/admin/audit-logs
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)

  const base = new URL(req.url)
  const origin = `${base.protocol}//${base.host}`

  const [brain, vault, audit] = await Promise.all([
    fetch(`${origin}/api/admin/unity-brain/interactions?limit=50`, { headers: { cookie: req.headers.get('cookie') || '' }, cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${origin}/api/admin/unity-savings-vault?limit=50&kind=advice`, { headers: { cookie: req.headers.get('cookie') || '' }, cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${origin}/api/admin/audit-logs?limit=200`, { headers: { cookie: req.headers.get('cookie') || '' }, cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
  ])

  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      brain: brain && brain.ok ? { ok: true, storage: brain.storage, rows: brain.rows } : { ok: false, error: brain?.error || 'Unavailable' },
      vault: vault && vault.ok ? { ok: true, rows: vault.rows } : { ok: false, error: vault?.error || 'Unavailable' },
      audit: audit && audit.ok ? { ok: true, storage: audit.storage, encrypted: audit.encrypted, logs: audit.logs } : { ok: false, error: audit?.error || 'Unavailable' },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


