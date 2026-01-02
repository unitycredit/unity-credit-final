import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'LOGIC_PROCESS')
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const forwarded = await callUnityBrainOffice({ path: '/v1/logic/process', body, req: req as any })
  if (!forwarded.ok) {
    const msg = String((forwarded.json as any)?.error || 'Brain office request failed')
    return NextResponse.json({ ok: false, error: msg, degraded: true }, { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json(forwarded.json, { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}