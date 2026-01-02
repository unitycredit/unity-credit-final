'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Bell } from 'lucide-react'
import DealCard, { type DealCardData } from '@/components/DealCard'
import { AUTONOMOUS_UI_ENABLED } from '@/lib/autonomous-ui'
import { MOCK_SMART_ALERTS } from '@/constants/mockData'

type Notif = {
  id: string
  kind: 'deal' | 'bill_ready' | 'negotiator_ready'
  title: string
  body?: string | null
  created_at: string
  deal?: any
}

function makeClientId() {
  try {
    const k = 'uc_notif_client_id_v1'
    const existing = window.localStorage.getItem(k)
    if (existing) return existing
    const id = `uc-${Math.random().toString(16).slice(2)}-${Date.now()}`
    window.localStorage.setItem(k, id)
    return id
  } catch {
    return `uc-${Date.now()}`
  }
}

export default function SmartAlertsPanel() {
  const [loading, setLoading] = useState(false)
  // Primary source: mock notifications (autonomous UI), with optional network hydration.
  const [data, setData] = useState<any>(MOCK_SMART_ALERTS as any)
  const [seen, setSeen] = useState<Record<string, boolean>>({})

  const clientId = useMemo(() => makeClientId(), [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('uc_notif_seen_v1') || '{}'
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setSeen(parsed)
    } catch {
      // ignore
    }
  }, [])

  const unseenCount = useMemo(() => {
    const items: Notif[] = Array.isArray(data?.items) ? data.items : []
    return items.filter((i) => !seen[i.id]).length
  }, [data, seen])

  async function load() {
    if (loading) return
    if (AUTONOMOUS_UI_ENABLED) {
      setData(MOCK_SMART_ALERTS as any)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/latest')
      const json = await res.json().catch(() => ({}))
      setData(json)
      if (!json || !Array.isArray((json as any)?.items)) setData((prev: any) => prev || (MOCK_SMART_ALERTS as any))
    } finally {
      setLoading(false)
    }
  }

  async function markSeen(ids: string[]) {
    if (!ids.length) return
    try {
      const next = { ...seen }
      for (const id of ids) next[id] = true
      setSeen(next)
      window.localStorage.setItem('uc_notif_seen_v1', JSON.stringify(next))
    } catch {
      // ignore
    }
    // Best-effort server persistence (helps multi-tab / future multi-user)
    fetch('/api/notifications/mark-seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ids }),
    }).catch(() => null)
  }

  useEffect(() => {
    load().catch(() => null)
    if (AUTONOMOUS_UI_ENABLED) return
    const id = window.setInterval(() => load().catch(() => null), 20_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items: Notif[] = Array.isArray(data?.items) ? data.items : []

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-700 to-gold" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Bell className="h-5 w-5" />
              סמאַרט־אַלערטן
              {unseenCount ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-xs font-black">
                  {unseenCount}
                </span>
              ) : null}
            </CardTitle>
            <div className="text-base text-slate-600 rtl-text text-right">
              פערזענליכע סאווינגס־אַלערטן לויט אייער הוצאות און לעבעדיגע דיעל־סיגנאלן.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-10" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              דערהיינטיקן
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => markSeen(items.map((i) => i.id))}
              disabled={!items.length}
            >
              מארקן אלעס געזען
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-600">
          דערהיינטיקט: <span className="font-mono">{String(data?.updated_at || '—').slice(0, 19)}</span>
        </div>

        <div className="space-y-3">
          {items.length ? (
            items.slice(0, 12).map((n) => {
              if (n.kind === 'deal' && n.deal) {
                const d: DealCardData = {
                  store: String(n.deal.store || ''),
                  title: String(n.deal.title || n.title || ''),
                  url: String(n.deal.url || '#'),
                  discount_pct: Number(n.deal.discount_pct || 0) || null,
                  original_price: n.deal.prev_price ?? null,
                  sale_price: n.deal.price ?? null,
                  savings_amount: n.deal.savings_amount ?? null,
                  price_crash: Boolean(n.deal.price_crash),
                  subtitle: n.body || null,
                }
                return (
                  <DealCard
                    key={n.id}
                    data={d}
                    onOpen={() => {
                      markSeen([n.id])
                    }}
                  />
                )
              }

              return (
                <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-black text-primary">{n.title}</div>
                  {n.body ? <div className="text-sm text-slate-700 mt-1">{n.body}</div> : null}
                  <div className="text-xs text-slate-500 mt-2 font-mono">{String(n.created_at || '').slice(0, 19)}</div>
                  <div className="mt-3">
                    <Button type="button" variant="outline" className="h-10" onClick={() => markSeen([n.id])}>
                      מארקן געזען
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-600">
              נאכנישטא קיין אלערטן. ווען די דיעל־האַנטער לויפט, וועלן זיך דא ווייזן “קויף יעצט” געלעגנהייטן.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


