import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { creditCardRowSchema } from '@/lib/finance/types'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'
import { sanitizeUnityLogicPublicText } from '@/lib/sanitize'
import { buildBrainAnalyzePacket90d } from '@/lib/finance/brain-analyze-packet'

export const runtime = 'nodejs'

export async function OPTIONS() {
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  // Pro lock sync: only Pro users can see detailed Brain agent advice.
  // (UI blurs the section, but we also enforce it here server-side.)
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
    // If the premium check fails, fail closed (security).
    return NextResponse.json(
      { ok: false, locked: true, error: 'Upgrade to Pro to view Unity Intelligence.' },
      { status: 402, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

  // Pull credit card context (for unified finance snapshot inside Brain).
  const { data: cardsRows } = await supabase.from('credit_cards').select('*').eq('user_id', user.id)
  const cards = (Array.isArray(cardsRows) ? cardsRows : [])
    .map((c: any) => creditCardRowSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => (r as any).data)
    .map((c: any) => ({ limit: Number(c.limit) || 0, balance: Number(c.balance) || 0 }))

  // Pull bank summary (best-effort) from DB-derived endpoint data.
  let bank: any = null
  let packet90d: any = null
  try {
    // Full 90-day PII-scrubbed packet for Brain analysis.
    packet90d = await buildBrainAnalyzePacket90d({ user_id: user.id, days: 90, limit: 2000 })

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: txRows } = await supabase
      .from('plaid_transactions')
      .select('amount,category_primary,merchant_name,name,occurred_on')
      .eq('user_id', user.id)
      .gte('occurred_on', since)
      .order('occurred_on', { ascending: false })
      .limit(500)

    const tx = Array.isArray(txRows) ? (txRows as any[]) : []
    let monthlyExpenses = 0
    let monthlyIncome = 0
    for (const t of tx) {
      const amt = Number((t as any)?.amount) || 0
      const cat = String((t as any)?.category_primary || '').toUpperCase()
      const isIncome = amt < 0 || cat === 'INCOME'
      if (isIncome) monthlyIncome += Math.abs(amt)
      else monthlyExpenses += Math.max(0, amt)
    }
    bank = {
      monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
      monthly_expenses: Math.round(monthlyExpenses),
      total_balance: null,
      accounts_count: null,
    }
  } catch {
    bank = null
    packet90d = null
  }

  const question = [
    'Give short Unity Intelligence financial guidance for my dashboard.',
    'Return exactly 3 bullet points.',
    'Be conservative and actionable. Keep it under 120 words.',
  ].join(' ')

  let forwarded: { ok: boolean; status: number; json: any }
  try {
    forwarded = await callUnityBrainOffice({
      path: '/v1/analyze',
      body: {
        user_id: user.id,
        question,
        cards,
        prefer_yiddish: false,
        context: {
          disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
          bank,
          // 3 months of transactions + debts (PII-scrubbed) for deeper analysis.
          analyze_packet_90d: packet90d,
        },
      },
      req: req as any,
    })
  } catch (e: any) {
    // Port 8090 unreachable / Brain offline.
    return NextResponse.json(
      { ok: false, error: 'Re-connecting to Unity Intelligence...', error_code: 'unreachable' },
      { status: 503, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  if (!forwarded.ok) {
    const msg = String((forwarded.json as any)?.error || 'Analyze failed')
    return NextResponse.json(
      { ok: false, error: msg },
      { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  const final = String((forwarded.json as any)?.final || (forwarded.json as any)?.text || (forwarded.json as any)?.insight || '').trim()
  return NextResponse.json(
    { ok: true, final: sanitizeUnityLogicPublicText(final) },
    { status: forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }
  )
}


