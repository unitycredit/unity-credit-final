'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Bell, ExternalLink } from 'lucide-react'
import { AUTONOMOUS_UI_ENABLED } from '@/lib/autonomous-ui'
import { MOCK_ACTIVE_SAVINGS_FEED } from '@/constants/mockData'

type FeedItem = {
  id: string
  store: string
  title: string
  url: string
  discount_pct: number
  price?: number | null
  prev_price?: number | null
  price_crash?: boolean
  buy_now_reason?: string | null
  observed_at: string
}

function fmtUsd(n: any) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return `$${v.toFixed(2)}`
}

export default function ActiveSavingsFeed() {
  const [loading, setLoading] = useState(false)
  // Primary source: mock feed (autonomous UI), with optional network hydration.
  const [feed, setFeed] = useState<any>(MOCK_ACTIVE_SAVINGS_FEED as any)
  const [seen, setSeen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('uc_active_savings_seen_v1') || '{}'
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setSeen(parsed)
    } catch {
      // ignore
    }
  }, [])

  const unseenCount = useMemo(() => {
    const items: FeedItem[] = Array.isArray(feed?.items) ? feed.items : []
    return items.filter((i) => !seen[i.id]).length
  }, [feed, seen])

  async function load() {
    if (loading) return
    if (AUTONOMOUS_UI_ENABLED) {
      setFeed(MOCK_ACTIVE_SAVINGS_FEED as any)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/active-savings/latest')
      const json = await res.json().catch(() => ({}))
      setFeed(json)
      // If server is down/unreachable, keep mock feed.
      if (!json || !Array.isArray((json as any)?.items)) setFeed((prev: any) => prev || (MOCK_ACTIVE_SAVINGS_FEED as any))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => null)
    if (AUTONOMOUS_UI_ENABLED) return
    const id = window.setInterval(() => load().catch(() => null), 30_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function markSeen(id: string) {
    try {
      const next = { ...seen, [id]: true }
      setSeen(next)
      window.localStorage.setItem('uc_active_savings_seen_v1', JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const items: FeedItem[] = Array.isArray(feed?.items) ? feed.items : []

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-emerald-600" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Bell className="h-5 w-5" />
              אקטיווע סאווינגס
              {unseenCount ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-xs font-black">
                  {unseenCount}
                </span>
              ) : null}
            </CardTitle>
            <div className="text-base text-slate-600 rtl-text text-right">
              קויפ־איצט געלעגנהייטן און פרייז־קראך־אַלערטן, פערזענליך לויט אייער הוצאות.
            </div>
          </div>
          <Button type="button" variant="outline" className="h-10" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            דערהיינטיקן
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-600">
          דערהיינטיקט: <span className="font-mono">{String(feed?.updated_at || '—').slice(0, 19)}</span>
        </div>

        <div className="space-y-2">
          {items.length ? (
            items.slice(0, 10).map((i) => (
              <div key={i.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-primary truncate">
                      {i.store} · {i.discount_pct}%+
                      {i.price_crash ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-black">
                          פרייז־קראך
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-800 mt-1">{i.title}</div>
                    <div className="text-xs text-slate-600 mt-2 flex gap-3 flex-wrap">
                      {fmtUsd(i.price) ? <span>איצט: {fmtUsd(i.price)}</span> : null}
                      {fmtUsd(i.prev_price) ? <span>שאַצונג פריער: {fmtUsd(i.prev_price)}</span> : null}
                      <span className="font-mono">{String(i.observed_at || '').slice(0, 19)}</span>
                    </div>
                    {i.buy_now_reason ? <div className="text-xs text-slate-600 mt-2">{String(i.buy_now_reason)}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="h-10 font-semibold"
                      onClick={() => {
                        markSeen(i.id)
                        window.open(i.url, '_blank', 'noreferrer')
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      קויף יעצט
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-600">
              נאכנישטא קיין אקטיווע סאווינגס. ווען די דיעל־האַנטער לויפט, וועלן זיך דא ווייזן געלעגנהייטן.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


