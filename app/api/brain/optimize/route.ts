import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { sanitizeInput } from '@/lib/security'
import { createClient } from '@/lib/supabase'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

function bad(status: number, error: string, details?: any) {
  return NextResponse.json({ ok: false, error, ...(details ? { details } : null) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function safeBills(v: any) {
  const arr = Array.isArray(v) ? v : []
  return arr
    .slice(0, 120)
    .map((b: any) => ({
      merchant: sanitizeInput(String(b?.merchant || '')).trim().slice(0, 120),
      category: sanitizeInput(String(b?.category || '')).trim().slice(0, 40),
      occurrences: Math.max(0, Math.min(24, Number(b?.occurrences || 0) || 0)),
      monthly_estimate: Math.max(0, Math.min(1_000_000, Number(b?.monthly_estimate || 0) || 0)),
      last_date: sanitizeInput(String(b?.last_date || '')).trim().slice(0, 20) || undefined,
    }))
    .filter((b: any) => b.merchant && b.monthly_estimate > 0)
}

function extractJsonObject(text: string): any | null {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'OPTIMIZATION_RUNS')
  if (!rl.allowed) return bad(429, 'Too many requests')

  // Require an authenticated user (personal optimization only).
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return bad(401, 'Unauthorized')
  } catch {
    return bad(401, 'Unauthorized')
  }

  const body = (await req.json().catch(() => ({}))) as any
  const bills = safeBills(body?.bills)
  const disclaimer_yi = String(body?.disclaimer_yi || '').trim() || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.'
  if (!bills.length) return bad(400, 'Missing bills payload')

  const forwarded = await callUnityBrainOffice({ path: '/v1/brain/optimize', body: { bills, disclaimer_yi }, req: req as any })
  if (!forwarded.ok) return bad(forwarded.status, String((forwarded.json as any)?.error || 'Optimization failed'), (forwarded.json as any)?.details)
  return NextResponse.json(forwarded.json, { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


