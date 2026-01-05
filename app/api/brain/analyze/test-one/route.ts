import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { callUnityBrainOffice, unityBrainOfficeUrl } from '@/lib/unity-brain-office'
import { sanitizeUnityLogicPublicText } from '@/lib/sanitize'

export const runtime = 'nodejs'

/**
 * Dev helper: send one synthetic transaction to Brain /v1/analyze and return its response.
 * This is for quick verification that the Brain is reachable and responding.
 */
export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production.' }, { status: 404, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  const tx = {
    occurred_on: new Date().toISOString().slice(0, 10),
    amount: 150.0,
    direction: 'outflow',
    currency: 'usd',
    category: 'TELECOMMUNICATIONS',
    merchant: 'Verizon',
    merchant_key: 'verizon',
  }

  const forwarded = await callUnityBrainOffice({
    path: '/v1/analyze',
    body: {
      question:
        'TEST: You received one transaction ($150 at Verizon; Telecommunications). Respond with 1 short bullet about a possible optimization and 1 sentence confirming receipt.',
      prefer_yiddish: false,
      context: {
        transactions: [tx],
      },
    },
    req: req as any,
  })

  if (!forwarded.ok) {
    const msg = String((forwarded.json as any)?.error || 'Analyze failed')
    if (forwarded.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Unity Brain rejected the request (401). Set UNITY_CREDIT_APP_KEY in .env.local (must match the Brain service allowlist) and retry.',
          sent_to: new URL('/v1/analyze', unityBrainOfficeUrl()).toString(),
        },
        { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
      )
    }
    // Pending approval/offline: show standard graceful fallback.
    if (forwarded.status === 403 || forwarded.status === 503) {
      return NextResponse.json(
        { ok: false, error: 'Unity Intelligence is currently optimizing your data...' },
        { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
      )
    }
    return NextResponse.json({ ok: false, error: msg }, { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  const final = String((forwarded.json as any)?.final || (forwarded.json as any)?.text || '').trim()
  return NextResponse.json(
    { ok: true, final: sanitizeUnityLogicPublicText(final) },
    { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


