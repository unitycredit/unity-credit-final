import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readBilling, readPaymentTail } from '@/lib/billing-store'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

function dayKey(iso: string) {
  return String(iso || '').slice(0, 10)
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ ok: false, error: 'נישט ערלויבט' }, { status: 401 })

  const days = clampInt(req.nextUrl.searchParams.get('days'), 7, 365, 90)
  const cacheKey = `uc:admin:metrics:v1:${days}`

  if (upstashEnabled()) {
    const cached = await upstashCmd<string>(['GET', cacheKey]).catch(() => null)
    const raw = String((cached as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        return NextResponse.json({ ...parsed, cached: true }, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        // ignore
      }
    }
  }

  const db = await readBilling()
  const subs = Object.values(db.subscribers || {})
  const now = Date.now()

  const activePremium = subs.filter((s) => s.premium_active && s.premium_until && Date.parse(s.premium_until) > now)
  const activeTrial = subs.filter((s: any) => Boolean(s.trial_active) && s.trial_until && Date.parse(String(s.trial_until)) > now)

  const totalRevenueCents = subs.reduce((sum, s) => sum + (Number(s.total_paid_cents) || 0), 0)

  // Payments tail for daily revenue (best-effort; for true scale, persist in DB/warehouse).
  const payments = await readPaymentTail(5000)
  const revenueByDay = new Map<string, number>()
  const trialsByDay = new Map<string, number>()
  const paidByDay = new Map<string, number>()
  for (const p of payments) {
    const d = dayKey(String(p.ts || ''))
    if (!d) continue
    const amt = Math.max(0, Number(p.amount_cents || 0) || 0)
    if (p.status === 'trial') trialsByDay.set(d, (trialsByDay.get(d) || 0) + 1)
    if (p.status === 'succeeded' || p.status === 'demo') {
      paidByDay.set(d, (paidByDay.get(d) || 0) + 1)
      revenueByDay.set(d, (revenueByDay.get(d) || 0) + amt)
    }
  }

  const createdByDay = new Map<string, number>()
  for (const s of subs) {
    const d = dayKey(String(s.created_at || ''))
    if (!d) continue
    createdByDay.set(d, (createdByDay.get(d) || 0) + 1)
  }

  const today = new Date()
  const series: Array<{
    day: string
    new_subscribers: number
    trials_started: number
    paid_events: number
    revenue_cents: number
  }> = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    series.push({
      day: key,
      new_subscribers: createdByDay.get(key) || 0,
      trials_started: trialsByDay.get(key) || 0,
      paid_events: paidByDay.get(key) || 0,
      revenue_cents: revenueByDay.get(key) || 0,
    })
  }

  const payload = {
    ok: true,
    updated_at: db.updated_at,
    days,
    subscribers: {
      total: subs.length,
      premium_active: activePremium.length,
      trial_active: activeTrial.length,
    },
    revenue: {
      total_cents: Math.max(0, totalRevenueCents),
      total_usd: (Math.max(0, totalRevenueCents) / 100).toFixed(2),
      last_day_cents: series.length ? series[series.length - 1].revenue_cents : 0,
      last_30d_cents: series.slice(-30).reduce((sum, x) => sum + (Number(x.revenue_cents) || 0), 0),
    },
    series,
  }

  if (upstashEnabled()) {
    await upstashCmd(['SETEX', cacheKey, 30, JSON.stringify(payload)]).catch(() => null) // 30s cache
  }

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}


