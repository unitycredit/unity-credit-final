import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { nowIso, type DealHunterDB, type PriceHistoryDB } from '@/lib/deal-hunter'

const DEALS_KEY = 'uc:deal_hunter:latest:v1'
const PRICES_KEY = 'uc:deal_hunter:prices:v1'

const DEALS_FILE = path.join(process.cwd(), '.data', 'deal_hunter_latest.json')
const PRICES_FILE = path.join(process.cwd(), '.data', 'deal_hunter_prices.json')

export function emptyDeals(): DealHunterDB {
  return { v: 1, updated_at: nowIso(), deals: [] }
}

export function emptyPrices(): PriceHistoryDB {
  return { v: 1, updated_at: nowIso(), items: {} }
}

// Back-compat: some admin-center routes call readDealHunterLatest({ marketMode }).
export async function readDealHunterLatest(_opts?: any): Promise<DealHunterDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', DEALS_KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.deals)) return parsed as DealHunterDB
      } catch {}
    }
    return emptyDeals()
  }
  try {
    const raw = await fs.readFile(DEALS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.deals)) return parsed as DealHunterDB
    return emptyDeals()
  } catch {
    return emptyDeals()
  }
}

export async function writeDealHunterLatest(db: DealHunterDB) {
  const safe: DealHunterDB = { v: 1, updated_at: nowIso(), deals: Array.isArray(db?.deals) ? db.deals : [] }
  const payload = JSON.stringify(safe, null, 2)
  if (upstashEnabled()) {
    await upstashCmd(['SET', DEALS_KEY, payload]).catch(() => null)
    return { ok: true as const, storage: 'redis' as const }
  }
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(DEALS_FILE, payload, 'utf8')
  return { ok: true as const, storage: 'file' as const }
}

export async function readPriceHistory(): Promise<PriceHistoryDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', PRICES_KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && parsed.items && typeof parsed.items === 'object') return parsed as PriceHistoryDB
      } catch {}
    }
    return emptyPrices()
  }
  try {
    const raw = await fs.readFile(PRICES_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && parsed.items && typeof parsed.items === 'object') return parsed as PriceHistoryDB
    return emptyPrices()
  } catch {
    return emptyPrices()
  }
}

export async function writePriceHistory(db: PriceHistoryDB) {
  const safe: PriceHistoryDB = { v: 1, updated_at: nowIso(), items: db?.items && typeof db.items === 'object' ? db.items : {} }
  const payload = JSON.stringify(safe, null, 2)
  if (upstashEnabled()) {
    await upstashCmd(['SET', PRICES_KEY, payload]).catch(() => null)
    return { ok: true as const, storage: 'redis' as const }
  }
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(PRICES_FILE, payload, 'utf8')
  return { ok: true as const, storage: 'file' as const }
}


