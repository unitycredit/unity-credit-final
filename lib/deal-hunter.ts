export type DealStore =
  | 'Bingo Wholesale'
  | 'Evergreen'
  | 'Walmart'
  | 'Costco'
  | 'B&H Photo'
  | 'Amazon'
  | 'Pomegranate'
  | 'Seasons'

export type DealItem = {
  id: string
  store: DealStore
  title: string
  url: string
  discount_pct: number
  price?: number | null
  prev_price?: number | null
  observed_at: string
  snippet?: string | null
  tags?: string[]
  buy_now?: boolean
  buy_now_reason?: string | null
  price_crash?: boolean
  crash_window_low?: number | null
}

export type PricePoint = { ts: string; price: number }

export type PriceHistoryDB = {
  v: 1
  updated_at: string
  // key: `${store}::${slug}`
  items: Record<string, { store: DealStore; slug: string; history: PricePoint[] }>
}

export type DealHunterDB = {
  v: 1
  updated_at: string
  deals: DealItem[]
}

export function nowIso() {
  return new Date().toISOString()
}

export function slugify(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/['"’”“]/g, '')
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function parsePercent(text: string): number | null {
  const t = String(text || '')
  // e.g. "25% off", "Save 30 %"
  const m = t.match(/(\d{1,2})(?:\.\d+)?\s*%/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(99, n))
}

export function parsePriceUSD(text: string): number | null {
  const t = String(text || '')
  // e.g. "$199.99" or "199.99"
  const m = t.match(/\$\s*([0-9]{1,6}(?:\.[0-9]{1,2})?)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function computePrevPrice(price: number, discountPct: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(discountPct) || discountPct <= 0 || discountPct >= 95) return null
  const prev = price / (1 - discountPct / 100)
  return Math.round(prev * 100) / 100
}

export function pruneHistory(points: PricePoint[], days = 180) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return points.filter((p) => {
    const ts = Date.parse(p.ts)
    return Number.isFinite(ts) && ts >= cutoff
  })
}

export function minPrice(points: PricePoint[]): number | null {
  let min: number | null = null
  for (const p of points) {
    const v = Number(p.price)
    if (!Number.isFinite(v) || v <= 0) continue
    if (min === null || v < min) min = v
  }
  return min
}


