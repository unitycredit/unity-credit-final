import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { unitySearch, type UnitySearchMode } from '@/lib/unity-search'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { isAdminRequest } from '@/lib/admin-auth'

export const runtime = 'nodejs'

function hashKey(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)
}

function safeMode(v: string): UnitySearchMode {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'flight_data') return 'flight_data'
  if (s === 'business_inventory') return 'business_inventory'
  return 'financial_bills'
}

function safeDate(v: string) {
  const s = String(v || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function safeHour(v: string) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  if (i < 0 || i > 23) return null
  return i
}

async function maybeVerifyWithBrain(req: NextRequest, payload: any) {
  // Optional verification trigger to validate real-time stream snapshots.
  // Off by default for scale; when enabled, it reuses /api/logic/process (which delegates to Unity Brain).
  const verify = String(req.nextUrl.searchParams.get('verify') || '').trim() === '1'
  if (!verify) return { verification: null }

  const url = new URL('/api/logic/process', req.url)
  const question =
    'Verify the following real-time API/search data snapshot for consistency and safety. Output STRICT JSON only: {"ok":boolean,"notes_yi":string,"confidence":number}. Notes must be in professional Yiddish.'

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      context: {
        workflow: 'verify_realtime_stream',
        stream: payload,
      },
    }),
    cache: 'no-store',
  })
  const json = await resp.json().catch(() => ({}))
  return { verification: { ok: resp.ok, result: json } }
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'SEARCH_READS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const q = String(req.nextUrl.searchParams.get('q') || '').trim()
  const mode = safeMode(String(req.nextUrl.searchParams.get('mode') || 'financial_bills'))
  const date = safeDate(String(req.nextUrl.searchParams.get('date') || ''))
  const hour = safeHour(String(req.nextUrl.searchParams.get('hour') || ''))
  const maxResults = Math.max(1, Math.min(10, Number(req.nextUrl.searchParams.get('max') || 6)))

  // Policy: business inventory mode is admin-only (even then, stubbed).
  if (mode === 'business_inventory' && !isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, blocked: true, error: 'בלאָקירט לויט פּאָליסי: ביזנעס־אינווענטאר זוכ־מאָדע איז נישט בנימצא פאר באַניצער.' },
      { status: 403, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

  const baseKey = `v1|${mode}|${q}|${date || ''}|${hour == null ? '' : String(hour)}|${maxResults}`
  const cacheKey = `uc:search:${hashKey([baseKey])}`

  if (upstashEnabled()) {
    const hit = await upstashCmd<string>(['GET', cacheKey]).catch(() => null)
    const raw = String((hit as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const res = NextResponse.json({ ok: true, cached: true, ...parsed }, { headers: rl.headers })
        res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
        return res
      } catch {
        // ignore
      }
    }
  }

  const searched = await unitySearch({ q, mode, date, hour, maxResults })
  if (!searched.ok) {
    return NextResponse.json(
      { ok: false, error: searched.error || 'Search failed', provider: searched.provider, blocked: (searched as any)?.blocked || false },
      { status: (searched as any)?.blocked ? 403 : 502, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

  const payload = {
    mode,
    q,
    date,
    hour,
    provider: searched.provider,
    results: searched.results,
    now: new Date().toISOString(),
  }

  // Optional verification (not cached by default).
  const verified = await maybeVerifyWithBrain(req, payload).catch(() => ({ verification: null }))
  const out = { ...payload, verification: verified.verification }

  // Cache the base payload (results) for scale; short TTL.
  if (upstashEnabled()) {
    await upstashCmd(['SETEX', cacheKey, 120, JSON.stringify(payload)]).catch(() => null) // 2 minutes
  }

  return NextResponse.json({ ok: true, ...out }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


