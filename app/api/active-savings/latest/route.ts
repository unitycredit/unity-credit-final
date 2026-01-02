import { NextRequest, NextResponse } from 'next/server'
import { readDealHunterLatest } from '@/lib/deal-hunter-store'
import { runDealHunterOnce } from '@/lib/deal-hunter-runner'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

function topStoresFromPlaid(parsed: any): string[] {
  const results = Array.isArray(parsed?.results) ? parsed.results : []
  const counts = new Map<string, number>()
  for (const r of results) {
    const txs = Array.isArray(r?.summary?.local_store_txs) ? r.summary.local_store_txs : Array.isArray(r?.local_store_txs) ? r.local_store_txs : []
    for (const t of txs) {
      const store = String(t?.store || '').trim()
      if (!store) continue
      counts.set(store, (counts.get(store) || 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k)
}

function storeMatchesDeal(storeKey: string, dealStore: string) {
  const s = String(storeKey || '').toLowerCase()
  const d = String(dealStore || '').toLowerCase()
  if (!s || !d) return false
  if (s === 'bingo') return d.includes('bingo')
  if (s === 'evergreen') return d.includes('evergreen')
  if (s === 'walmart') return d.includes('walmart')
  if (s === 'costco') return d.includes('costco')
  return false
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'ACTIVE_SAVINGS_READS')

  // Fast-path cache (Redis). Keep TTL very short because deals change frequently.
  const CACHE_KEY = 'uc:active_savings:latest:v1'
  if (upstashEnabled()) {
    const cached = await upstashCmd<string>(['GET', CACHE_KEY]).catch(() => null)
    const raw = String((cached as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const res = NextResponse.json(parsed, { headers: { ...rl.headers } })
        res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
        return res
      } catch {
        // fall through
      }
    }
  }

  const dealsDb = await readDealHunterLatest()
  let deals = Array.isArray(dealsDb?.deals) ? dealsDb.deals : []

  // Activate “live” feed: if there are no deals yet, generate a first snapshot now.
  // This is safe because `runDealHunterOnce` falls back to a lightweight offline feed when Live Search is not configured.
  if (!deals.length) {
    try {
      await runDealHunterOnce({ minDiscountPct: 25 })
      const refreshed = await readDealHunterLatest()
      deals = Array.isArray(refreshed?.deals) ? refreshed.deals : []
    } catch {
      // ignore
    }
  }

  let plaid: any = null
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'plaid_latest.json'), 'utf8')
    plaid = JSON.parse(raw)
  } catch {
    plaid = null
  }

  const topStores = plaid ? topStoresFromPlaid(plaid) : []

  const personalized =
    topStores.length > 0
      ? deals.filter((d) => topStores.some((s) => storeMatchesDeal(s, d.store)))
      : deals

  // Price Crash first, then highest discounts
  personalized.sort((a: any, b: any) => {
    const ac = a.price_crash ? 1 : 0
    const bc = b.price_crash ? 1 : 0
    if (ac !== bc) return bc - ac
    return Number(b.discount_pct || 0) - Number(a.discount_pct || 0)
  })

  const payload = {
    ok: true,
    updated_at: dealsDb?.updated_at || null,
    top_stores: topStores,
    items: personalized.slice(0, 25),
  }

  if (upstashEnabled()) {
    await upstashCmd(['SETEX', 'uc:active_savings:latest:v1', 10, JSON.stringify(payload)]).catch(() => null)
  }

  const res = NextResponse.json(payload, { headers: { ...rl.headers } })
  res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
  return res
}


