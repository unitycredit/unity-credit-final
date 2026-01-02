import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { authenticateWithBrain } from '@/lib/brain-handshake'

export const runtime = 'nodejs'

export async function OPTIONS() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed)
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )

  // Body is unused for now; keep POST to avoid browser/proxy caching and for future extensibility.
  await req.json().catch(() => null)

  const out = await authenticateWithBrain()
  if (out.state === 'active') {
    return NextResponse.json(
      { ok: true, state: 'active' },
      { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )
  }
  if (out.state === 'pending') {
    return NextResponse.json(
      { ok: false, state: 'pending', message: 'Unity Intelligence is currently optimizing your data...' },
      { status: 403, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )
  }
  return NextResponse.json(
    { ok: false, state: 'error', error: out.error || 'Handshake failed' },
    { status: out.status || 500, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
  )
}


