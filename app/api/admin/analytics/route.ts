import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readPlaidLatestSnapshot } from '@/lib/plaid-snapshot-store'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function dayKey(iso: string) {
  return String(iso || '').slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  // Total transactions processed: from .data/plaid_latest.json (best-effort dev/sandbox snapshot)
  let totalTransactions = 0
  try {
    const parsed = await readPlaidLatestSnapshot()
    const results = Array.isArray(parsed?.results) ? parsed.results : []
    for (const r of results) {
      const count = Number(r?.summary?.transaction_count) || 0
      totalTransactions += count
    }
  } catch {
    totalTransactions = 0
  }

  // Savings applied: from Supabase `user_savings_events` (500k+ scale)
  let totalSavedMonthly = 0
  const byDay = new Map<string, number>()
  const admin = createAdminClient()
  if (admin) {
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await admin
        .from('user_savings_events')
        .select('created_at,monthly_savings')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000)

      const rows = Array.isArray(data) ? data : []
      for (const r of rows) {
        const m = Number((r as any)?.monthly_savings || 0) || 0
        if (m > 0) totalSavedMonthly += m
        const d = dayKey(String((r as any)?.created_at || ''))
        if (d) byDay.set(d, (byDay.get(d) || 0) + (m > 0 ? m : 0))
      }
    } catch {
      totalSavedMonthly = 0
    }
  }

  // last 14 days series
  const today = new Date()
  const series: Array<{ day: string; saved: number }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    series.push({ day: key, saved: Math.round(byDay.get(key) || 0) })
  }

  return NextResponse.json({
    ok: true,
    transactions: { total_processed: totalTransactions },
    savings: { total_monthly_saved: Math.round(totalSavedMonthly), series_14d: series },
  })
}


