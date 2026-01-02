import { webSearch } from '@/lib/web-search'
import { nowIso, parsePercent, parsePriceUSD, computePrevPrice, slugify, pruneHistory, minPrice, type DealItem, type DealStore } from '@/lib/deal-hunter'
import { readCategoryCatalog } from '@/lib/category-catalog-store'
import { readDealHunterLatest, readPriceHistory, writeDealHunterLatest, writePriceHistory } from '@/lib/deal-hunter-store'

function storeListFromCatalog(db: any): DealStore[] {
  const cats = Array.isArray(db?.categories) ? db.categories : []
  const providers = cats.flatMap((c: any) => (Array.isArray(c?.providers) ? c.providers : []))
  const names = providers.map((p: any) => String(p?.name || '').trim()).filter(Boolean)
  const set = new Set(names.map((n: string) => n.toLowerCase()))
  const out: DealStore[] = []
  const push = (name: DealStore, key: string) => {
    if (set.has(key.toLowerCase())) out.push(name)
  }
  push('Bingo Wholesale', 'Bingo Wholesale')
  push('Evergreen', 'Evergreen')
  push('Pomegranate', 'Pomegranate')
  push('Seasons', 'Seasons')
  push('Walmart', 'Walmart')
  push('Amazon', 'Amazon')
  push('B&H Photo', 'B&H Photo')
  // Costco may not be in catalog, but it’s requested; include it unconditionally for price flips.
  if (!out.includes('Costco')) out.push('Costco')
  return out.length ? out : (['Bingo Wholesale', 'Evergreen', 'Walmart', 'Amazon', 'B&H Photo', 'Costco'] as DealStore[])
}

function queriesForStore(store: DealStore) {
  const base =
    store === 'Walmart'
      ? ['site:walmart.com']
      : store === 'Amazon'
      ? ['site:amazon.com']
      : store === 'B&H Photo'
      ? ['site:bhphotovideo.com', 'B&H']
      : store === 'Costco'
      ? ['costco']
      : [store]

  return [
    `${base.join(' ')} deal 25% off`,
    `${base.join(' ')} clearance 25% off`,
    `${base.join(' ')} coupon 25% off`,
  ]
}

export async function runDealHunterOnce(params?: { minDiscountPct?: number }) {
  const minDiscountPct = Math.max(5, Math.min(90, Number(params?.minDiscountPct ?? 25)))
  const catalog = await readCategoryCatalog().catch(() => null)
  const stores = storeListFromCatalog(catalog)

  const priceDb = await readPriceHistory()
  const latest = await readDealHunterLatest()

  const deals: DealItem[] = []
  const now = nowIso()

  // Live search is disabled in the Shell; generate a small offline feed so UI remains functional.
  {
    const offline: DealItem[] = [
      {
        id: `deal-${slugify('bingo bulk special')}-${Date.now()}`,
        store: 'Bingo Wholesale',
        title: 'Bulk Special (demo) — 25%+ basket optimization opportunity',
        url: 'https://example.com',
        discount_pct: 25,
        price: null,
        prev_price: null,
        observed_at: now,
        snippet: 'Offline placeholder feed (live discovery disabled).',
        tags: ['offline'],
        buy_now: true,
        buy_now_reason: `Offline demo item.`,
        price_crash: false,
      },
      {
        id: `deal-${slugify('bh high-ticket')}-${Date.now()}`,
        store: 'B&H Photo',
        title: 'High-ticket alert (demo) — compare tax savings vs rewards',
        url: 'https://example.com',
        discount_pct: 25,
        price: 3500,
        prev_price: 4666.67,
        observed_at: now,
        snippet: 'Use the Payboo vs Points Optimizer for the exact math.',
        tags: ['offline', 'high_ticket'],
        buy_now: true,
        buy_now_reason: 'High-ticket opportunity: compare tax-savings vs rewards value.',
        price_crash: false,
      },
    ]
    const db = { v: 1 as const, updated_at: now, deals: offline }
    await writeDealHunterLatest(db)
    return { ok: true as const, mode: 'offline' as const, updated_at: now, deals: offline, stores }
  }

  for (const store of stores) {
    for (const q of queriesForStore(store)) {
      const res = await webSearch(q, { maxResults: 6 })
      if (!res.ok) continue
      for (const r of res.results) {
        const text = `${r.title || ''} ${r.snippet || ''}`.trim()
        const pct: number = parsePercent(text) ?? 0
        if (pct < minDiscountPct) continue
        const price = parsePriceUSD(text)
        let prev: number | null = null
        if (typeof price === 'number') {
          // TS should narrow here, but Next/tsc sometimes fails control-flow narrowing in this build.
          prev = computePrevPrice(price as number, pct)
        }
        const slug = slugify(r.title || r.url)
        const id = `deal-${slug}-${Date.now()}-${Math.random().toString(16).slice(2)}`

        // Price crash detection (6 months window) when price exists
        const histKey = `${store}::${slug}`
        let crash = false
        let low: number | null = null
        if (typeof price === 'number') {
          const p = price as number
          const entry = priceDb.items[histKey] || { store, slug, history: [] as any[] }
          entry.history = pruneHistory(entry.history || [], 180)
          low = minPrice(entry.history)
          // price is a "crash" if it is <= previous low by at least 1%
          if (low !== null) {
            const lowNum = low as number
            if (p <= lowNum * 0.99) crash = true
          }
          entry.history.push({ ts: now, price: p })
          entry.history = pruneHistory(entry.history, 180).slice(-240)
          priceDb.items[histKey] = entry
        }

        deals.push({
          id,
          store,
          title: r.title || 'Deal',
          url: r.url,
          discount_pct: pct,
          price: price ?? null,
          prev_price: prev,
          observed_at: now,
          snippet: r.snippet || null,
          tags: ['25plus'],
          buy_now: Boolean(pct >= minDiscountPct) || crash,
          buy_now_reason: crash
            ? 'Price Crash: lowest observed price in the last 6 months (based on stored history).'
            : pct >= minDiscountPct
            ? `Discount ≥ ${minDiscountPct}% detected.`
            : null,
          price_crash: crash,
          crash_window_low: low,
        })
      }
    }
  }

  // Keep most actionable first
  deals.sort((a, b) => {
    const aCrash = a.price_crash ? 1 : 0
    const bCrash = b.price_crash ? 1 : 0
    if (aCrash !== bCrash) return bCrash - aCrash
    return (b.discount_pct || 0) - (a.discount_pct || 0)
  })

  const dedup = new Map<string, DealItem>()
  for (const d of deals) {
    const k = `${d.store}::${slugify(d.title)}`
    if (!dedup.has(k)) dedup.set(k, d)
  }
  const finalDeals = Array.from(dedup.values()).slice(0, 80)

  const out = { v: 1 as const, updated_at: now, deals: finalDeals }
  await writeDealHunterLatest(out)
  await writePriceHistory({ ...priceDb, v: 1, updated_at: now })

  return { ok: true as const, mode: 'search_only', updated_at: now, deals: finalDeals, stores }
}


