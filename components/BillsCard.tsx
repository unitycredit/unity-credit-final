'use client'

import { useEffect, useMemo, useState } from 'react'
import { Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toFiniteNumber } from '@/lib/finance/number'

type RecurringBill = {
  merchant: string
  category: string
  occurrences: number
  monthly_estimate: number
  last_date?: string
}

export default function BillsCard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bills, setBills] = useState<RecurringBill[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await fetch('/api/optimization/latest', { method: 'GET' })
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`)

        const list = (json?.result?.recurring_bills || []) as any[]
        const rows: RecurringBill[] = Array.isArray(list)
          ? list.map((r) => ({
              merchant: String(r?.merchant || ''),
              category: String(r?.category || ''),
              occurrences: Math.round(toFiniteNumber(r?.occurrences, 0)),
              monthly_estimate: toFiniteNumber(r?.monthly_estimate, 0),
              last_date: r?.last_date ? String(r.last_date) : undefined,
            }))
          : []

        if (!alive) return
        setBills(rows.filter((r) => r.merchant))
        setUpdatedAt(json?.updated_at ? String(json.updated_at) : null)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Failed to load bills')
        setBills([])
        setUpdatedAt(null)
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const top = useMemo(() => bills.slice(0, 8), [bills])

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 to-indigo-600" />
      <CardHeader className="pb-3 rtl-text text-right">
        <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2 justify-end">
          <Receipt className="h-5 w-5 text-sky-600" />
          בילס
        </CardTitle>
        <div className="rtl-text text-right text-xs text-muted-foreground">
          {updatedAt ? `דערהיינטיקט: ${new Date(updatedAt).toLocaleString('he-IL')}` : 'באַזירט אויף א קעש־סנאַפּשאָט (ווען בנימצא)'}
        </div>
      </CardHeader>
      <CardContent className="rtl-text text-right">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-muted-foreground rtl-text">
            {error}
          </div>
        ) : top.length ? (
          <div className="space-y-2">
            {top.map((r) => (
              <div key={`${r.merchant}-${r.category}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div className="rtl-text text-right">
                  <div className="font-bold text-primary rtl-text">{r.merchant}</div>
                  <div className="text-xs text-muted-foreground rtl-text">
                    {r.category}
                    {r.occurrences ? ` · ${r.occurrences}x` : ''}
                    {r.last_date ? ` · לעצטע: ${r.last_date}` : ''}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-black text-primary">${toFiniteNumber(r.monthly_estimate, 0).toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground rtl-text">/ חודש (שאצונג)</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-muted-foreground rtl-text">
            קיין רעקארירנדע בילס זענען נישט בנימצא (נאך).
          </div>
        )}
      </CardContent>
    </Card>
  )
}


