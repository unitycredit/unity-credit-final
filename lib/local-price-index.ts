import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type StoreKey = 'bingo' | 'evergreen' | 'walmart' | 'costco'

export type VisitRange = {
  store: StoreKey
  min: number
  max: number
  updated_at: string
  notes?: string | null
}

export type LocalPriceIndexDB = {
  v: 1
  updated_at: string
  visit_ranges: VisitRange[]
}

const KEY = 'uc:price_index:local:v1'
const FILE = path.join(process.cwd(), '.data', 'local_price_index.json')

function nowIso() {
  return new Date().toISOString()
}

export function defaultLocalPriceIndexDB(): LocalPriceIndexDB {
  const ts = nowIso()
  return {
    v: 1,
    updated_at: ts,
    visit_ranges: [
      { store: 'bingo', min: 60, max: 260, updated_at: ts, notes: 'Typical grocery/bulk visit range (demo defaults).' },
      { store: 'evergreen', min: 30, max: 160, updated_at: ts, notes: 'Typical mid-week basket range (demo defaults).' },
      { store: 'walmart', min: 20, max: 180, updated_at: ts, notes: 'Household essentials range (demo defaults).' },
      { store: 'costco', min: 80, max: 420, updated_at: ts, notes: 'Bulk club range (demo defaults).' },
    ],
  }
}

export async function readLocalPriceIndex(): Promise<LocalPriceIndexDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.visit_ranges)) return parsed as LocalPriceIndexDB
      } catch {
        // ignore
      }
    }
    return defaultLocalPriceIndexDB()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.visit_ranges)) return parsed as LocalPriceIndexDB
    return defaultLocalPriceIndexDB()
  } catch {
    return defaultLocalPriceIndexDB()
  }
}

export async function writeLocalPriceIndex(next: LocalPriceIndexDB) {
  const safe: LocalPriceIndexDB = {
    v: 1,
    updated_at: nowIso(),
    visit_ranges: Array.isArray(next?.visit_ranges) ? next.visit_ranges : [],
  }
  const payload = JSON.stringify(safe, null, 2)

  if (upstashEnabled()) {
    await upstashCmd(['SET', KEY, payload]).catch(() => null)
    return { ok: true as const, storage: 'redis' as const }
  }

  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, payload, 'utf8')
  return { ok: true as const, storage: 'file' as const }
}

export function upsertVisitRange(db: LocalPriceIndexDB, patch: { store: StoreKey; min: number; max: number; notes?: string | null }) {
  const ts = nowIso()
  const ranges = Array.isArray(db.visit_ranges) ? [...db.visit_ranges] : []
  const idx = ranges.findIndex((r) => r.store === patch.store)
  const next: VisitRange = {
    store: patch.store,
    min: Math.max(0, Math.round(Number(patch.min) || 0)),
    max: Math.max(0, Math.round(Number(patch.max) || 0)),
    notes: patch.notes ?? null,
    updated_at: ts,
  }
  if (idx >= 0) ranges[idx] = next
  else ranges.push(next)
  return { ...db, updated_at: ts, visit_ranges: ranges }
}


