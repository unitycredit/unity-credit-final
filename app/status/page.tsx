import { getAppUrl } from '@/lib/app-url'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'

export const revalidate = 10

type Check = {
  name: string
  ok: boolean
  status?: number
  ms?: number | null
  details?: any
}

async function fetchJson(path: string) {
  const base = getAppUrl()
  const url = new URL(path, base)
  const started = Date.now()
  const res = await fetch(url, { next: { revalidate: 10 } })
  const ms = Date.now() - started
  const json = await res.json().catch(() => ({}))
  return { status: res.status, ms, json }
}

export default async function StatusPage() {
  const [nodes, db, plaid] = await Promise.allSettled([
    fetchJson('/api/health/nodes'),
    fetchJson('/api/health/db'),
    fetchJson('/api/health/plaid'),
  ])

  const checks: Check[] = [
    nodes.status === 'fulfilled'
      ? { name: 'Verification Nodes', ok: Boolean(nodes.value.json?.ok), status: nodes.value.status, ms: nodes.value.json?.ms ?? nodes.value.ms, details: nodes.value.json }
      : { name: 'Verification Nodes', ok: false, details: { error: nodes.reason?.message || String(nodes.reason) } },
    db.status === 'fulfilled'
      ? { name: 'Supabase Database', ok: Boolean(db.value.json?.ok), status: db.value.status, ms: db.value.ms, details: db.value.json }
      : { name: 'Supabase Database', ok: false, details: { error: db.reason?.message || String(db.reason) } },
    plaid.status === 'fulfilled'
      ? { name: 'Plaid API', ok: Boolean(plaid.value.json?.ok), status: plaid.value.status, ms: plaid.value.json?.ms ?? plaid.value.ms, details: plaid.value.json }
      : { name: 'Plaid API', ok: false, details: { error: plaid.reason?.message || String(plaid.reason) } },
  ]

  const allOk = checks.every((c) => c.ok)
  const updatedAt = new Date().toLocaleString('he-IL')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#f8fafc] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-primary">System Status</h1>
            <div className="text-sm text-slate-600">
              Last updated: <span className="font-semibold">{updatedAt}</span> (cached ~10s for speed)
            </div>
          </div>
          <UnityCreditBrandStack size="sm" label="UnityCredit" aria-label="UnityCredit" />
        </div>

        <div
          className={[
            'rounded-2xl border p-4',
            allOk ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900' : 'border-amber-200 bg-amber-50/60 text-amber-900',
          ].join(' ')}
        >
          <div className="font-black">{allOk ? 'All systems operational' : 'Degraded performance detected'}</div>
            <div className="text-sm mt-1 rtl-text text-right">
              די בלאט מאָניטאָרט די הויפּט־דינסטן: Verification Nodes, Supabase, און Plaid.
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {checks.map((c) => (
            <div key={c.name} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-primary">{c.name}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {typeof c.status === 'number' ? `HTTP ${c.status}` : '—'}
                    {typeof c.ms === 'number' ? ` · ${c.ms}ms` : ''}
                  </div>
                </div>
                <div className={['text-xs font-black px-3 py-1 rounded-full', c.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'].join(' ')}>
                  {c.ok ? 'OK' : 'DOWN'}
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                {/* Intentionally do NOT dump raw JSON here (keeps UI clean and avoids leaking internal identifiers). */}
                {c.ok ? 'Healthy.' : `Error: ${String(c.details?.error || 'unknown')}`}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          Tip: for sub‑500ms loads at scale, this page uses short caching and parallel checks.
        </div>
      </div>
    </div>
  )
}


