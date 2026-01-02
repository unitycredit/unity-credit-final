import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { authenticateWithBrain, unityBrainBaseUrl } from '@/lib/brain-handshake'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const base = unityBrainBaseUrl()
  const out = await authenticateWithBrain().catch((e: any) => ({ ok: false as const, status: 500, state: 'error' as const, error: e?.message || 'handshake failed' }))

  if (out.state === 'active') {
    // eslint-disable-next-line no-console
    console.log(`Brain handshake: 200 OK (${base})`)
  }

  return NextResponse.json(
    { ok: out.state === 'active', state: out.state, status: out.status, brain_base_url: base, error: (out as any).error || null },
    { status: out.state === 'active' ? 200 : out.status || 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


