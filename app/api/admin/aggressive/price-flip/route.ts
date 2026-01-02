import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readLocalPriceIndex } from '@/lib/local-price-index'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

function storeLabel(k: string) {
  return k === 'bingo' ? 'Bingo Wholesale' : k === 'evergreen' ? 'Evergreen' : k === 'walmart' ? 'Walmart' : k === 'costco' ? 'Costco' : k
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const threshold = Math.max(1, Math.min(5, Number(req.nextUrl.searchParams.get('mult') || 1.2))) // default 1.2x max

  const idx = await readLocalPriceIndex()
  const ranges = Array.isArray(idx.visit_ranges) ? idx.visit_ranges : []
  const rangeMap = new Map<string, { min: number; max: number }>()
  for (const r of ranges) rangeMap.set(r.store, { min: Number(r.min) || 0, max: Number(r.max) || 0 })

  let parsed: any = null
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'plaid_latest.json'), 'utf8')
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: true, updated_at: null, alerts: [] })
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : []
  const alerts: any[] = []

  for (const r of results) {
    const txs = Array.isArray(r?.summary?.local_store_txs) ? r.summary.local_store_txs : Array.isArray(r?.local_store_txs) ? r.local_store_txs : []
    for (const t of txs) {
      const store = String(t?.store || '').trim()
      const amt = Number(t?.amount || 0) || 0
      if (!store || amt <= 0) continue
      const range = rangeMap.get(store)
      if (!range || !range.max) continue
      if (amt > range.max * threshold) {
        alerts.push({
          store,
          store_label: storeLabel(store),
          amount: amt,
          date: String(t?.date || ''),
          merchant: String(t?.merchant || ''),
          expected_max: range.max,
          severity: amt > range.max * 1.8 ? 'high' : 'medium',
          note: 'Price Flip: transaction exceeds expected visit range. Consider switching stores or auditing the receipt.',
        })
      }
    }
  }

  alerts.sort((a, b) => Number(b.amount) - Number(a.amount))
  return NextResponse.json({ ok: true, updated_at: String(parsed?.updated_at || ''), threshold, alerts: alerts.slice(0, 50) })
}


