import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { buildLast30DaysTransactionBundle } from '@/lib/finance/brain-transaction-bundle'
import { callUnityBrainOffice, unityBrainOfficeUrl } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

function sampleBundle() {
  return {
    window_days: 30,
    generated_at: new Date().toISOString(),
    totals: { tx_count: 3, outflow_total: 245.67, inflow_total: 1200, currency: 'usd' },
    top_merchants: [
      { merchant: 'Verizon', spend: 89.99, tx_count: 1 },
      { merchant: 'Geico', spend: 155.68, tx_count: 1 },
    ],
    top_categories: [
      { category: 'PHONE', spend: 89.99, tx_count: 1 },
      { category: 'INSURANCE', spend: 155.68, tx_count: 1 },
    ],
    transactions: [
      {
        occurred_on: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: 89.99,
        direction: 'outflow',
        currency: 'usd',
        category: 'PHONE',
        merchant: 'Verizon',
        merchant_key: 'verizon',
      },
      {
        occurred_on: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: 155.68,
        direction: 'outflow',
        currency: 'usd',
        category: 'INSURANCE',
        merchant: 'Geico',
        merchant_key: 'geico',
      },
      {
        occurred_on: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: 1200,
        direction: 'inflow',
        currency: 'usd',
        category: 'INCOME',
        merchant: 'Payroll',
        merchant_key: 'payroll',
      },
    ],
  }
}

/**
 * Temporary dev-only test sync endpoint.
 * Calls Brain /v1/analyze and returns the raw Brain JSON so the dashboard button can console.log it.
 */
export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production.' }, { status: 404, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })

  // Best-effort: use real local transactions if available; otherwise use a small sample bundle.
  let txBundle: any = null
  try {
    txBundle = await buildLast30DaysTransactionBundle({ user_id: user.id, limit: 500 })
  } catch {
    txBundle = null
  }
  if (!txBundle || !Array.isArray(txBundle.transactions) || txBundle.transactions.length === 0) {
    txBundle = sampleBundle()
  }

  const question =
    'TEST SYNC: Please confirm you received the transactions_30d payload and return 2 bullet points of observations. Keep it short.'

  const forwarded = await callUnityBrainOffice({
    path: '/v1/analyze',
    body: {
      question,
      prefer_yiddish: false,
      context: {
        disclaimer_yi: 'TEST MODE',
        transactions_30d: txBundle,
      },
    },
    req: req as any,
  })

  return NextResponse.json(
    {
      ok: forwarded.ok,
      status: forwarded.status,
      sent_to: new URL('/v1/analyze', unityBrainOfficeUrl()).toString(),
      request_preview: { tx_count: txBundle?.totals?.tx_count ?? txBundle?.transactions?.length ?? 0 },
      brain: forwarded.json || null,
    },
    { status: forwarded.ok ? 200 : forwarded.status, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


