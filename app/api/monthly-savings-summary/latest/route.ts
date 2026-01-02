import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { readDealHunterLatest } from '@/lib/deal-hunter-store'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

type SeriesPoint = { month: string; value: number }

type Summary = {
  ok: boolean
  updated_at: string
  provider: { monthly_total: number }
  flash: { one_time_total: number }
  applied: { six_month_total: number; series_6mo: SeriesPoint[] }
  potential: { monthly: number; six_month: number; nodes_used: boolean; nodes_note: string | null }
  chart: { months: string[]; applied: SeriesPoint[]; potential: SeriesPoint[] }
}

const OPT_KEY = 'uc:opt:latest'
const OPT_FILE = path.join(process.cwd(), '.data', 'optimization_latest.json')

function ym(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthsBack(n: number) {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(ym(d))
  }
  return out
}

function sumMonthlyFromRecommendations(recs: any[]) {
  const items = Array.isArray(recs) ? recs : []
  let total = 0
  for (const r of items) {
    const v = Number((r as any)?.monthly_savings || 0)
    if (Number.isFinite(v) && v > 0) total += v
  }
  return Math.round(total)
}

function providerMonthlyFromRecommendations(recs: any[]) {
  const items = Array.isArray(recs) ? recs : []
  let total = 0
  for (const r of items) {
    const cat = String((r as any)?.category || '').toLowerCase()
    const v = Number((r as any)?.monthly_savings || 0)
    if (!Number.isFinite(v) || v <= 0) continue
    if (cat.includes('insurance') || cat.includes('utilities') || cat.includes('phone') || cat.includes('internet')) total += v
  }
  return Math.round(total)
}

async function readOptimizationRecommendations(): Promise<any[] | null> {
  // Same storage strategy as /api/optimization/latest, but we only need recommendations.
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', OPT_KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const recs = (parsed as any)?.result?.recommendations
        return Array.isArray(recs) ? recs : null
      } catch {
        // fall through
      }
    }
  }

  try {
    const raw = await fs.readFile(OPT_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const recs = (parsed as any)?.result?.recommendations
    return Array.isArray(recs) ? recs : null
  } catch {
    return null
  }
}

function flashOneTimeTotalFromDeals(deals: any[]) {
  const items = Array.isArray(deals) ? deals : []
  let total = 0
  for (const d of items) {
    const price = Number((d as any)?.price)
    const prev = Number((d as any)?.prev_price)
    if (!Number.isFinite(price) || !Number.isFinite(prev)) continue
    if (price <= 0 || prev <= 0) continue
    const diff = prev - price
    if (diff > 0) total += diff
  }
  return Math.round(total)
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'MONTHLY_SAVINGS_SUMMARY_READS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const nowIso = new Date().toISOString()
  const months = monthsBack(6)

  // Flash deals: global feed (personalization is handled in /api/active-savings/latest; here we provide a simple total).
  const dealsDb = await readDealHunterLatest().catch(() => null)
  const oneTimeTotal = flashOneTimeTotalFromDeals((dealsDb as any)?.deals || [])

  // Default: fallback to latest optimization snapshot (non-auth, or no user history yet).
  const optRecs = await readOptimizationRecommendations()
  const fallbackPotentialMonthly = sumMonthlyFromRecommendations(optRecs || [])
  const fallbackProviderMonthly = providerMonthlyFromRecommendations(optRecs || [])

  let appliedSeries: SeriesPoint[] = months.map((m) => ({ month: m, value: 0 }))
  let potentialSeries: SeriesPoint[] = months.map((m) => ({ month: m, value: fallbackPotentialMonthly }))
  let appliedSixMonthTotal = 0
  let potentialMonthly = fallbackPotentialMonthly
  let providerMonthly = fallbackProviderMonthly
  let nodesUsed = false
  let nodesNote: string | null = optRecs && optRecs.length ? 'שאצונג לויט אייער לעצטע דאטא־סנאַפּשאָט.' : null

  // If user is authenticated, compute from Supabase tables (RLS-safe).
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id || null

    if (userId) {
      const start = new Date()
      start.setMonth(start.getMonth() - 6)

      const [eventsRes, snapsRes] = await Promise.all([
        supabase
          .from('user_savings_events')
          .select('monthly_savings, created_at')
          .eq('user_id', userId)
          .eq('event_kind', 'apply')
          .gte('created_at', start.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('user_savings_snapshots')
          .select('payload, created_at')
          .eq('user_id', userId)
          .eq('kind', 'savings_finder')
          .gte('created_at', start.toISOString())
          .order('created_at', { ascending: false })
          .limit(250),
      ])

      const events = Array.isArray((eventsRes as any)?.data) ? ((eventsRes as any).data as any[]) : []
      const snaps = Array.isArray((snapsRes as any)?.data) ? ((snapsRes as any).data as any[]) : []

      // Applied: sum by month (events are "applied" clicks, treated as attributed monthly savings).
      const appliedByMonth = new Map<string, number>()
      for (const e of events) {
        const dt = new Date(String(e.created_at || ''))
        const key = ym(new Date(dt.getFullYear(), dt.getMonth(), 1))
        const v = Number(e.monthly_savings || 0)
        if (!Number.isFinite(v) || v <= 0) continue
        appliedByMonth.set(key, (appliedByMonth.get(key) || 0) + v)
      }
      appliedSeries = months.map((m) => ({ month: m, value: Math.round(appliedByMonth.get(m) || 0) }))
      appliedSixMonthTotal = Math.round(appliedSeries.reduce((acc, p) => acc + (Number(p.value) || 0), 0))

      // Potential: use the latest snapshot per month (so chart is stable even with many snapshots).
      const latestSnapByMonth = new Map<string, any>()
      for (const s of snaps) {
        const dt = new Date(String(s.created_at || ''))
        const key = ym(new Date(dt.getFullYear(), dt.getMonth(), 1))
        if (!latestSnapByMonth.has(key)) latestSnapByMonth.set(key, s)
      }
      potentialSeries = months.map((m) => {
        const snap = latestSnapByMonth.get(m)
        const recs = (snap as any)?.payload?.recommendations
        const v = sumMonthlyFromRecommendations(Array.isArray(recs) ? recs : [])
        return { month: m, value: v }
      })

      // "Current" potential/provider from the newest snapshot.
      const newest = snaps[0]
      const newestRecs = (newest as any)?.payload?.recommendations
      if (Array.isArray(newestRecs)) {
        potentialMonthly = sumMonthlyFromRecommendations(newestRecs)
        providerMonthly = providerMonthlyFromRecommendations(newestRecs)
      }
      nodesUsed = Boolean((newest as any)?.payload?.verified)
      nodesNote = nodesUsed ? 'וועריפיצירט דורך די 5 נאָדן (קאַנסענסוס).' : 'שאצונג (אָן קאַנסענסוס־וועריפיקאציע).'
    }
  } catch {
    // ignore: fall back to non-auth snapshot
  }

  const payload: Summary = {
    ok: true,
    updated_at: nowIso,
    provider: { monthly_total: providerMonthly },
    flash: { one_time_total: oneTimeTotal },
    applied: { six_month_total: appliedSixMonthTotal, series_6mo: appliedSeries },
    potential: { monthly: potentialMonthly, six_month: Math.round(potentialMonthly * 6), nodes_used: nodesUsed, nodes_note: nodesNote },
    chart: { months, applied: appliedSeries, potential: potentialSeries },
  }

  const res = NextResponse.json(payload, { headers: { ...rl.headers } })
  res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60')
  return res
}


