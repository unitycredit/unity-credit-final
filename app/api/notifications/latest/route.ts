import { NextResponse } from 'next/server'
import { readGlobalNotifications, type NotificationItem } from '@/lib/notifications'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

function topSignalsFromPlaid(parsed: any) {
  const results = Array.isArray(parsed?.results) ? parsed.results : []

  const storeCounts = new Map<string, number>()
  const hubCounts = new Map<string, number>() // pomegranate, seasons, etc

  for (const r of results) {
    const txs = Array.isArray(r?.summary?.local_store_txs)
      ? r.summary.local_store_txs
      : Array.isArray(r?.local_store_txs)
      ? r.local_store_txs
      : []
    for (const t of txs) {
      const store = String(t?.store || '').trim()
      if (!store) continue
      storeCounts.set(store, (storeCounts.get(store) || 0) + 1)
    }

    const hubs = Array.isArray(r?.summary?.heimish_hubs)
      ? r.summary.heimish_hubs
      : Array.isArray(r?.heimish_hubs)
      ? r.heimish_hubs
      : []
    for (const h of hubs) {
      const k = String(h?.key || '').trim()
      const tx = Number(h?.tx_count || 0) || 0
      if (!k || tx <= 0) continue
      hubCounts.set(k, (hubCounts.get(k) || 0) + tx)
    }
  }

  const topStores = Array.from(storeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k)

  const topHubs = Array.from(hubCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k)

  return { topStores, topHubs }
}

function matchesPreference(notif: NotificationItem, prefs: { topStores: string[]; topHubs: string[] }) {
  const store = String(notif?.deal?.store || '').toLowerCase()
  const storeKeys = prefs.topStores.map((s) => String(s).toLowerCase())
  const hubKeys = prefs.topHubs.map((s) => String(s).toLowerCase())

  // storeKeys are from local_store_txs: bingo/evergreen/walmart/costco
  if (storeKeys.some((k) => k && store.includes(k))) return true

  // hubKeys are from heimish_hubs: pomegranate/seasons/etc
  if (hubKeys.includes('pomegranate') && store.includes('pomegranate')) return true
  if (hubKeys.includes('seasons') && store.includes('seasons')) return true

  return false
}

export async function GET() {
  const db = await readGlobalNotifications()
  const items = Array.isArray(db?.items) ? db.items : []

  let plaid: any = null
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'plaid_latest.json'), 'utf8')
    plaid = JSON.parse(raw)
  } catch {
    plaid = null
  }

  const prefs = plaid ? topSignalsFromPlaid(plaid) : { topStores: [], topHubs: [] }

  const scored = items.map((n) => {
    let score = 0
    if (n.kind === 'deal') {
      score += Number(n?.deal?.discount_pct || 0)
      if (n?.deal?.price_crash) score += 40
      if (matchesPreference(n, prefs)) score += 25
    }
    if (n.kind === 'bill_ready') score += 30
    if (n.kind === 'negotiator_ready') score += 20
    return { n, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const out = scored.slice(0, 60).map((x) => x.n)

  return NextResponse.json({
    ok: true,
    updated_at: db?.updated_at || null,
    personalization: prefs,
    items: out,
  })
}


