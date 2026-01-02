import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'plaid_latest.json'), 'utf8')
    const parsed = JSON.parse(raw)
    const results = Array.isArray(parsed?.results) ? parsed.results : []

    const totals = new Map<string, { key: string; label: string; spend: number; tx_count: number; last_date: string | null }>()
    for (const r of results) {
      const hubs = Array.isArray(r?.summary?.heimish_hubs) ? r.summary.heimish_hubs : Array.isArray(r?.heimish_hubs) ? r.heimish_hubs : []
      for (const h of hubs) {
        const key = String(h?.key || '').trim()
        const label = String(h?.label || key).trim()
        const spend = Number(h?.spend || 0) || 0
        const tx = Number(h?.tx_count || 0) || 0
        const last = String(h?.last_date || '').trim() || null
        if (!key) continue
        const prev = totals.get(key) || { key, label, spend: 0, tx_count: 0, last_date: null as string | null }
        prev.spend += spend
        prev.tx_count += tx
        if (last && (!prev.last_date || last > prev.last_date)) prev.last_date = last
        totals.set(key, prev)
      }
    }

    const hubs = Array.from(totals.values()).sort((a, b) => b.spend - a.spend)
    return NextResponse.json({ ok: true, updated_at: String(parsed?.updated_at || ''), hubs })
  } catch {
    return NextResponse.json({ ok: true, updated_at: null, hubs: [] })
  }
}


