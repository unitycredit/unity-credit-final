import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { sanitizeInput } from '@/lib/security'
import { appendVerificationAudit } from '@/lib/audit-trail'
import { readAdminSettings } from '@/lib/admin-settings'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

function safeDomain(v: string) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'inventory') return 'inventory'
  if (s === 'travel') return 'travel'
  return 'savings'
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const question = sanitizeInput(String(body?.question || '')).trim()
  const system = String(body?.system || '').trim()
  const domain = safeDomain(String(body?.domain || 'savings'))
  const request_id = String(body?.request_id || '').trim() || `brain-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const disclaimer_yi = sanitizeInput(String(body?.disclaimer_yi || '')).trim() || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.'
  const prefer_yiddish = Boolean(body?.prefer_yiddish ?? true)

  if (!question || !system) {
    return NextResponse.json({ ok: false, error: 'Missing question/system' }, { status: 400, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  const settings = await readAdminSettings().catch(() => null)
  const require_all_nodes =
    typeof settings?.require_all_nodes === 'boolean' ? settings.require_all_nodes : String(process.env.UNITY_REQUIRE_ALL_NODES || 'true') === 'true'

  try {
    const forwarded = await callUnityBrainOffice({
      path: '/v1/execute-intelligence',
      body: { domain, question, system, request_id, disclaimer_yi, prefer_yiddish, require_all_nodes },
      req: req as any,
    })
    if (!forwarded.ok) {
      return NextResponse.json({ ok: false, error: (forwarded.json as any)?.error || 'Brain office error' }, { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
    }

    const shaped = forwarded.json as any

    // Persist audit trail (encrypted when configured) without internal categories.
    await appendVerificationAudit({
      request_id,
      ok: Boolean(shaped.ok),
      blocked: Boolean((shaped as any).blocked),
      reason: shaped.ok ? null : (shaped as any).error,
      domain,
      verification: (shaped as any).verification || null,
      source: 'unity_brain_master',
    }).catch(() => null)

    return NextResponse.json(
      {
        ...shaped,
        request_id,
      },
      { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    await appendVerificationAudit({ request_id, ok: false, blocked: true, reason: e?.message || 'Intelligence error', domain, source: 'unity_brain_master' }).catch(() => null)
    return NextResponse.json({ ok: false, blocked: true, error: 'Intelligence error' }, { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }
}


