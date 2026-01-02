import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { emptyCatalog, nowIso, type CategoryCatalogDB, type CategoryCatalogEntry } from '@/lib/category-catalog'

const KEY = 'uc:catalog:categories:v1'
const FILE = path.join(process.cwd(), '.data', 'category_catalog.json')

export async function readCategoryCatalog(): Promise<CategoryCatalogDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.categories)) return parsed as CategoryCatalogDB
      } catch {
        // ignore
      }
    }
    return emptyCatalog()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.categories)) return parsed as CategoryCatalogDB
    return emptyCatalog()
  } catch {
    return emptyCatalog()
  }
}

export async function writeCategoryCatalog(next: CategoryCatalogDB) {
  const safe: CategoryCatalogDB = {
    v: 1,
    updated_at: nowIso(),
    categories: Array.isArray(next?.categories) ? next.categories : [],
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

export function summarizeCatalog(db: CategoryCatalogDB) {
  const categories = Array.isArray(db?.categories) ? db.categories : []
  let providers = 0
  let offers = 0
  let discounts = 0
  for (const c of categories) {
    providers += Array.isArray(c.providers) ? c.providers.length : 0
    for (const p of Array.isArray(c.providers) ? c.providers : []) {
      offers += Array.isArray(p.offers) ? p.offers.length : 0
      discounts += Array.isArray(p.hidden_discounts) ? p.hidden_discounts.length : 0
    }
  }
  return { categories: categories.length, providers, offers, hidden_discounts: discounts }
}

export function upsertCatalogCategory(db: CategoryCatalogDB, entry: CategoryCatalogEntry) {
  const categories = Array.isArray(db.categories) ? [...db.categories] : []
  const idx = categories.findIndex((c) => c.key === entry.key)
  if (idx >= 0) categories[idx] = entry
  else categories.unshift(entry)
  return { ...db, categories, updated_at: nowIso() }
}


