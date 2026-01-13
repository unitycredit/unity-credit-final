'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, Shield } from 'lucide-react'
import { toFiniteNumber } from '@/lib/finance/number'
import { getSupabaseAnonClient } from '@/lib/supabase-browser'
import { AUTONOMOUS_UI_ENABLED } from '@/lib/autonomous-ui'
import { getLocalSession } from '@/lib/local-session'
import { MOCK_MONTHLY_SAVINGS_SUMMARY } from '@/constants/mockData'

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pathFromSeries(series: SeriesPoint[], w: number, h: number) {
  if (!series.length) return ''
  const max = Math.max(1, ...series.map((p) => toFiniteNumber(p.value, 0)))
  const step = series.length > 1 ? w / (series.length - 1) : w
  return series
    .map((p, i) => {
      const x = i * step
      const y = h - (clamp(toFiniteNumber(p.value, 0), 0, max) / max) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function areaFromSeries(series: SeriesPoint[], w: number, h: number) {
  const line = pathFromSeries(series, w, h)
  if (!line) return ''
  return `${line} L ${w.toFixed(1)} ${h.toFixed(1)} L 0 ${h.toFixed(1)} Z`
}

export default function MonthlySavingsSummary() {
  const [loading, setLoading] = useState(false)
  // Primary source: local mock data (autonomous UI). Network can optionally hydrate/override it.
  const [data, setData] = useState<Summary | null>(MOCK_MONTHLY_SAVINGS_SUMMARY as any)
  const guestModeActive = useMemo(() => {
    const bypassCookieEnabled =
      typeof document !== 'undefined' && /(?:^|;\s*)uc_dev_bypass=1(?:;|$)/.test(document.cookie || '')
    let email = ''
    try {
      if (typeof window !== 'undefined') email = String(getLocalSession()?.email || '').trim().toLowerCase()
    } catch {
      // ignore
    }
    return bypassCookieEnabled || email.startsWith('guest@')
  }, [])
  const reportGeneratedLabel = useMemo(() => {
    const d = new Date()
    const human = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
    return `Report Generated: ${human}`
  }, [])

  async function load() {
    if (loading) return
    // Guest mode: never hit network/Supabase. Keep the UI fully populated with mock data.
    if (guestModeActive) {
      setData(MOCK_MONTHLY_SAVINGS_SUMMARY as any)
      return
    }
    if (AUTONOMOUS_UI_ENABLED) {
      setData(MOCK_MONTHLY_SAVINGS_SUMMARY as any)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/monthly-savings-summary/latest')
      const json = (await res.json().catch(() => null)) as Summary | null
      if (json && json.ok) setData(json)
      if (!json || !json.ok) setData((prev) => prev || (MOCK_MONTHLY_SAVINGS_SUMMARY as any))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => null)
    if (guestModeActive) return
    if (AUTONOMOUS_UI_ENABLED) return
    const id = window.setInterval(() => load().catch(() => null), 30_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: refresh immediately when the Brain writes a new savings snapshot or apply event.
  useEffect(() => {
    if (guestModeActive) return
    if (AUTONOMOUS_UI_ENABLED) return
    const { client } = getSupabaseAnonClient()
    if (!client) return

    let timer: any = null
    const trigger = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => load().catch(() => null), 350)
    }

    const channel = client
      .channel('uc-monthly-savings-summary')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_savings_snapshots', filter: `kind=eq.savings_finder` },
        () => trigger()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_savings_events', filter: `event_kind=eq.apply` }, () =>
        trigger()
      )
      .subscribe()

    return () => {
      if (timer) window.clearTimeout(timer)
      client.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const w = 720
  const h = 120

  const appliedLine = useMemo(() => areaFromSeries(data?.chart?.applied || [], w, h), [data])
  const potentialLine = useMemo(() => areaFromSeries(data?.chart?.potential || [], w, h), [data])

  const lastMonthLabel = useMemo(() => {
    const months = data?.chart?.months || []
    return months.length ? months[months.length - 1] : '—'
  }, [data])

  return (
    <Card className="border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] text-white">
      <div className="h-1.5 w-full bg-[#001f3f]" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Shield className="h-5 w-5 text-gold" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/70 rtl-text text-right">
                  UnityCredit · Unity Report
                </div>
                <div className="text-2xl md:text-3xl font-black tracking-tight rtl-text text-right">
                  <span dir="ltr">Potential Savings</span>{' '}
                  <span className="text-white/80 font-semibold">(פּאָטענציעלע סעווינגס)</span>:{' '}
                  <span className="text-[#00ff00] font-mono">${toFiniteNumber(data?.potential?.monthly, 0).toFixed(0)}/mo</span>
                </div>
                <div className="text-xs text-white/70 mt-1 rtl-text text-right" dir="ltr">
                  {reportGeneratedLabel}
                </div>
                <div className="text-[16px] text-white/75 mt-1 rtl-text text-right">
                  Monthly Provision:{' '}
                  <span className="font-mono font-black text-white">${toFiniteNumber(data?.potential?.six_month, 0).toFixed(0)}/mo</span>
                  <span className="mx-2 text-white/30">·</span>
                  Projected Savings:{' '}
                  <span className="font-mono font-black text-white">${toFiniteNumber(data?.applied?.six_month_total, 0).toFixed(0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-black text-white/80">
              Calculated
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-white/10 border-white/15 text-white hover:bg-white/15"
              onClick={load}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60 rtl-text text-right">Monthly Provision</div>
            <div className="mt-1 text-2xl font-black font-mono text-[#00ff00] rtl-text text-right">${toFiniteNumber(data?.provider?.monthly_total, 0).toFixed(0)}/mo</div>
            <div className="text-sm text-white/55 mt-2 rtl-text text-right">Insurance, utilities, and phone options.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60 rtl-text text-right">Flash Deals (one-time)</div>
            <div className="mt-1 text-2xl font-black font-mono text-white">${toFiniteNumber(data?.flash?.one_time_total, 0).toFixed(0)}</div>
            <div className="text-sm text-white/55 mt-2 rtl-text text-right">25%+ deal drops based on your frequent merchants.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60 rtl-text text-right">Chart Window</div>
            <div className="mt-1 text-2xl font-black text-white rtl-text text-right">{lastMonthLabel}</div>
            <div className="text-sm text-white/55 mt-2 rtl-text text-right">
              {data?.potential?.nodes_note ? data.potential.nodes_note : 'געמאסטן און מאדעלירט לויט אייער לעצטע היסטאריע.'}
            </div>
          </div>
        </div>

        {!data && !loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/85 rtl-text text-right">
            Unity Intelligence is currently optimizing your data...
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[16px] font-black text-white/85 rtl-text text-right">Spending Analysis</div>
            <div className="text-xs text-white/55">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Actual Expenses
              </span>
              <span className="mx-3 text-white/25">·</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400" /> Projected Savings
              </span>
            </div>
          </div>

          <div className="mt-3">
            <svg width="100%" height="160" viewBox={`0 0 ${w} ${h + 40}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradPotential" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(52, 211, 153, 0.45)" />
                  <stop offset="100%" stopColor="rgba(52, 211, 153, 0.02)" />
                </linearGradient>
                <linearGradient id="gradApplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(99, 102, 241, 0.45)" />
                  <stop offset="100%" stopColor="rgba(99, 102, 241, 0.02)" />
                </linearGradient>
              </defs>

              {/* grid */}
              <g opacity="0.25">
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <line key={t} x1="0" x2={w} y1={t * h} y2={t * h} stroke="white" strokeWidth="1" />
                ))}
              </g>

              {/* areas */}
              {potentialLine ? <path d={potentialLine} fill="url(#gradPotential)" /> : null}
              {appliedLine ? <path d={appliedLine} fill="url(#gradApplied)" /> : null}

              {/* strokes */}
              {potentialLine ? <path d={pathFromSeries(data?.chart?.potential || [], w, h)} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth="2" /> : null}
              {appliedLine ? <path d={pathFromSeries(data?.chart?.applied || [], w, h)} fill="none" stroke="rgba(99,102,241,0.95)" strokeWidth="2" /> : null}

              {/* x labels */}
              <g transform={`translate(0, ${h + 28})`} fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">
                {(data?.chart?.months || []).map((m, idx, arr) => {
                  if (idx !== 0 && idx !== Math.floor(arr.length / 2) && idx !== arr.length - 1) return null
                  const x = (idx / Math.max(1, arr.length - 1)) * w
                  return (
                    <text key={m} x={x} y={0} textAnchor={idx === 0 ? 'start' : idx === arr.length - 1 ? 'end' : 'middle'}>
                      {m}
                    </text>
                  )
                })}
              </g>
            </svg>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/45">
          Updated: <span className="font-mono">{String(data?.updated_at || '—').slice(0, 19)}</span>
        </div>
      </CardContent>
    </Card>
  )
}


