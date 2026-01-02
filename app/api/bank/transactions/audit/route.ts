import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function isoDateDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

/**
 * Diagnostic endpoint for the Unity Credit window:
 * Confirms Plaid transactions are landing in the local DB and shows a small sample.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const since = isoDateDaysAgo(30)
  const { data: rows, error } = await supabase
    .from('plaid_transactions')
    .select('occurred_on,amount,currency,merchant_name,name,category_primary,created_at')
    .eq('user_id', user.id)
    .gte('occurred_on', since)
    .order('occurred_on', { ascending: false })
    .limit(25)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const tx = Array.isArray(rows) ? (rows as any[]) : []
  return NextResponse.json({
    ok: true,
    window_days: 30,
    sample_count: tx.length,
    sample: tx.map((t) => ({
      occurred_on: String(t.occurred_on || ''),
      amount: Number(t.amount || 0),
      currency: String(t.currency || 'usd'),
      merchant: String(t.merchant_name || t.name || ''),
      category: String(t.category_primary || 'Unknown'),
      created_at: String(t.created_at || ''),
    })),
  })
}


