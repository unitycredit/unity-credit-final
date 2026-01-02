import React, { useEffect, useState } from 'react'

type Stats = {
  ok: boolean
  warning?: string
  revenue: { mrr_usd: number | null; arr_usd: number | null }
  ai_usage: { interactions_30d: number | null; insights_total: number | null }
  users: { growth_30d: number | null }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/v1/admin/stats', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as Stats | null
        if (!res.ok || !json) throw new Error('Failed to load stats')
        if (!cancelled) setStats(json)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Unity Brain · Admin Control Center</h1>
      <p style={{ marginTop: 8, color: '#555' }}>
        Revenue, Intelligence usage, and user growth (central office view).
      </p>

      {error ? <div style={{ marginTop: 12, color: '#b00020' }}>{error}</div> : null}
      {stats?.warning ? <div style={{ marginTop: 12, color: '#8a6d3b' }}>{stats.warning}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Revenue</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>MRR: ${stats?.revenue.mrr_usd ?? 0}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: '#333' }}>ARR: ${stats?.revenue.arr_usd ?? 0}</div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#666' }}>Intelligence Usage</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>Interactions (30d): {stats?.ai_usage.interactions_30d ?? 0}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: '#333' }}>Insights (total): {stats?.ai_usage.insights_total ?? 0}</div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#666' }}>User Growth</div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>Growth (30d): {stats?.users.growth_30d ?? 0}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: '#333' }}>Source: unified Supabase</div>
        </div>
      </div>
    </div>
  )
}


