'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

type Mode = 'financial_bills' | 'flight_data' | 'business_inventory'

export default function UnityGlobalSearch() {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('financial_bills')
  const [q, setQ] = useState('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [hour, setHour] = useState<string>(() => String(new Date().getHours()))
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const hourSafe = useMemo(() => {
    const n = Number(hour)
    if (!Number.isFinite(n)) return ''
    const i = Math.max(0, Math.min(23, Math.floor(n)))
    return String(i)
  }, [hour])

  async function run() {
    const query = q.trim()
    if (!query) return
    if (loading) return
    setLoading(true)
    try {
      const u = new URL('/api/search', window.location.origin)
      u.searchParams.set('q', query)
      u.searchParams.set('mode', mode)
      if (date) u.searchParams.set('date', date)
      if (hourSafe !== '') u.searchParams.set('hour', hourSafe)
      u.searchParams.set('max', '6')
      const resp = await fetch(u.toString(), { method: 'GET' })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'Search failed')
      setResults(Array.isArray(json?.results) ? json.results : [])
      setOpen(true)
    } catch (e: any) {
      toast({ title: 'Search', description: e?.message || 'Search failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hidden lg:flex items-center gap-2">
      <select
        value={mode}
        onChange={(e) => setMode((e.target.value as any) || 'financial_bills')}
        className="h-9 rounded-xl border border-slate-300 bg-white text-slate-900 px-3 text-sm"
      >
        <option value="financial_bills" className="text-slate-900">בילס</option>
        <option value="flight_data" className="text-slate-900">פליג־דאטא</option>
        <option value="business_inventory" className="text-slate-900">ביזנעס (בלאָקירט)</option>
      </select>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-9 w-[280px] bg-white border-slate-300 text-[#1a1a1a] placeholder:text-slate-500"
        placeholder="זוך… (למשל: Verizon bill)"
      />
      <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="h-9 w-[150px] bg-white border-slate-300 text-[#1a1a1a]" />
      <Input value={hour} onChange={(e) => setHour(e.target.value)} className="h-9 w-[70px] bg-white border-slate-300 text-[#1a1a1a]" placeholder="Hour" />
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={loading} className="h-9">
        {loading ? '…' : 'Search'}
      </Button>

      {open ? (
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-[760px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-primary rtl-text text-right">רעזולטאטן</div>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className="mt-3 space-y-2 max-h-[360px] overflow-auto">
            {results.length ? (
              results.map((r, idx) => (
                <a
                  key={idx}
                  href={String(r.url || '')}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100 transition"
                >
                  <div className="text-xs font-bold text-slate-800">{String(r.title || '').slice(0, 200)}</div>
                  <div className="text-[11px] text-slate-600 break-words">{String(r.url || '').slice(0, 220)}</div>
                  {r.snippet ? <div className="text-[11px] text-slate-600 mt-1">{String(r.snippet || '').slice(0, 260)}</div> : null}
                </a>
              ))
            ) : (
              <div className="text-xs text-slate-600 rtl-text text-right">קיין רעזולטאטן.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}


