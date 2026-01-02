import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runPlaidRefresh } from '@/lib/plaid-refresh'
import { readAdminSettings } from '@/lib/admin-settings'

export const runtime = 'nodejs'

const KEY = 'uc:opt:latest'

function authorized(req: NextRequest) {
  const secret = process.env.OPTIMIZATION_ENGINE_SECRET || ''
  const provided = req.headers.get('x-optimization-secret') || ''
  return Boolean((secret && provided && secret === provided) || isAdminRequest(req))
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'OPTIMIZATION_RUNS')
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers })

  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const settings = await readAdminSettings().catch(() => null)
  const disclaimer_yi = String(settings?.disclaimer_yi || '').trim()

  const started = Date.now()

  // Step 1: refresh bank snapshot (best-effort; dev cache)
  const refresh = await runPlaidRefresh().catch((e: any) => ({ ok: false as const, error: e?.message || 'refresh failed' }))
  if (!refresh.ok) {
    return NextResponse.json({ error: refresh.error || 'Refresh failed' }, { status: 500 })
  }

  // Step 2: compute optimization recommendations (reuses existing server logic)
  const url = new URL('/api/savings-finder', req.url)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disclaimer_yi }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    return NextResponse.json({ error: json?.error || 'Optimization run failed', details: json }, { status: resp.status })
  }

  const payload = {
    updated_at: new Date().toISOString(),
    refresh_count: Number((refresh as any).count || 0),
    result: json,
    ms: Date.now() - started,
  }

  // Step 3: store for instant reads (Redis preferred)
  if (upstashEnabled()) {
    await upstashCmd(['SETEX', KEY, 300, JSON.stringify(payload)]).catch(() => null) // 5 minutes
  } else {
    const dir = path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'optimization_latest.json'), JSON.stringify(payload, null, 2), 'utf8')
  }

  return NextResponse.json({ ok: true, ...payload }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


