import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { creditCardRowSchema } from '@/lib/finance/types'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'
import { sanitizeUnityLogicPublicText } from '@/lib/sanitize'
import { buildLast30DaysTransactionBundle } from '@/lib/finance/brain-transaction-bundle'

export const runtime = 'nodejs'

function sumMonthlySavingsFromRecommendations(recs: any[]): number {
  if (!Array.isArray(recs)) return 0
  let total = 0
  for (const r of recs) {
    const v = Number((r as any)?.monthly_savings || 0)
    if (Number.isFinite(v) && v > 0) total += v
  }
  return Math.round(total)
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  // Require auth: advice is personalized to the user's cards + savings snapshots.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })

  // Pro lock sync (server-side): fail closed unless the Brain confirms the user's subscription status.
  try {
    const url = new URL('/api/premium/status', req.url)
    const cookie = req.headers.get('cookie') || ''
    const resp = await fetch(url, { method: 'GET', headers: { ...(cookie ? { cookie } : {}) }, cache: 'no-store' })
    const j: any = await resp.json().catch(() => ({}))
    const tier = String(j?.tier || 'free').toLowerCase()
    const unlocked = tier === 'pro' || tier === 'trial' || tier === 'premium'
    if (!unlocked) {
      return NextResponse.json(
        { ok: false, locked: true, error: 'Upgrade to Pro to view Unity Intelligence.' },
        { status: 402, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
      )
    }
  } catch {
    return NextResponse.json(
      { ok: false, locked: true, error: 'Upgrade to Pro to view Unity Intelligence.' },
      { status: 402, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

  // Cards context
  const { data: cardsRows } = await supabase.from('credit_cards').select('*').eq('user_id', user.id)
  const cards = (Array.isArray(cardsRows) ? cardsRows : [])
    .map((c: any) => creditCardRowSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => (r as any).data)
    .map((c: any) => ({ limit: Number(c.limit) || 0, balance: Number(c.balance) || 0 }))

  // Transactions context (last 30 days, cleaned)
  let txBundle: any = null
  try {
    txBundle = await buildLast30DaysTransactionBundle({ user_id: user.id, limit: 800 })
  } catch {
    txBundle = null
  }

  // Latest savings snapshot context (best-effort)
  let savingsPotentialMonthly: number | null = null
  try {
    const snap = await supabase
      .from('user_savings_snapshots')
      .select('payload, created_at')
      .eq('user_id', user.id)
      .eq('kind', 'savings_finder')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const recs = (snap as any)?.data?.payload?.recommendations
    if (Array.isArray(recs)) savingsPotentialMonthly = sumMonthlySavingsFromRecommendations(recs)
  } catch {
    savingsPotentialMonthly = null
  }

  const question =
    [
      'Give me short, actionable Unity Intelligence guidance for my dashboard.',
      'Return exactly 3 bullet points, prioritized from highest impact to lowest.',
      'Focus on credit utilization + simple savings actions. Keep it under 120 words.',
      savingsPotentialMonthly !== null ? `My current savings potential estimate is about $${savingsPotentialMonthly}/mo.` : null,
    ]
      .filter(Boolean)
      .join(' ')

  const forwarded = await callUnityBrainOffice({
    path: '/v1/analyst-agent',
    body: {
      question,
      cards,
      context: {
        transactions_30d: txBundle,
      },
    },
    req: req as any,
  })

  // Backward compatibility: older Brain deployments may not have /v1/analyst-agent yet.
  const finalForwarded =
    forwarded.ok || forwarded.status !== 404
      ? forwarded
      : await callUnityBrainOffice({
          path: '/v1/professional-advice',
          body: { question, cards },
          req: req as any,
        })

  if (!finalForwarded.ok) {
    const msg = String((finalForwarded.json as any)?.error || 'Analyst agent failed')
    // Pending approval / offline: show the graceful fallback copy the dashboard expects.
    if (finalForwarded.status === 403 || finalForwarded.status === 503) {
      return NextResponse.json(
        { ok: false, error: 'Unity Intelligence is currently optimizing your data...' },
        { status: finalForwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
      )
    }
    return NextResponse.json({ ok: false, error: msg }, { status: finalForwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  const final = String((finalForwarded.json as any)?.final || '').trim()
  return NextResponse.json(
    { ok: true, final: sanitizeUnityLogicPublicText(final) },
    { status: finalForwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


