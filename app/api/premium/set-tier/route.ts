import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'

export const runtime = 'nodejs'

type Tier = 'free' | 'pro'

function normalizeTier(raw: unknown): Tier {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'pro') return 'pro'
  return 'free'
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const tier = normalizeTier(body?.tier)

  const res = NextResponse.json({ ok: true, tier }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  if (tier === 'free') {
    res.cookies.set('uc_tier', '', { path: '/', maxAge: 0 })
  } else {
    // Demo/pro gate cookie. Premium is handled by the real billing store.
    res.cookies.set('uc_tier', tier, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  }
  return res
}


