import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { defaultCategorySeeds, emptyCatalog, nowIso, type CategoryCatalogEntry } from '@/lib/category-catalog'
import { readCategoryCatalog, summarizeCatalog, upsertCatalogCategory, writeCategoryCatalog } from '@/lib/category-catalog-store'
import { generateCatalogEntry } from '@/lib/category-catalog-generator'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const mode = String(body?.mode || 'seed') // seed | all | one
  const oneKey = sanitizeInput(String(body?.key || '')).trim()
  const limit = Math.max(1, Math.min(10, Number(body?.limit || 5))) // safety for serverless time

  let db = await readCategoryCatalog().catch(() => emptyCatalog())
  if (!Array.isArray(db.categories)) db = emptyCatalog()

  if (mode === 'seed') {
    // Ensure default categories exist without overwriting user edits.
    const existing = new Set(db.categories.map((c) => c.key))
    const seeds = defaultCategorySeeds()
    const add: CategoryCatalogEntry[] = []
    for (const s of seeds) {
      if (existing.has(s.key)) continue
      add.push({
        key: s.key,
        label: s.label,
        kind: s.kind,
        updated_at: nowIso(),
        generated_at: null,
        providers: [],
        sources: [],
        raw: null,
      })
    }
    if (add.length) {
      db = { ...db, categories: [...add, ...db.categories], updated_at: nowIso() }
      await writeCategoryCatalog(db)
    }
    return NextResponse.json({ ok: true, seeded: add.length, summary: summarizeCatalog(db) })
  }

  const targets =
    mode === 'one' && oneKey
      ? db.categories.filter((c) => c.key === oneKey)
      : db.categories
          .slice()
          .sort((a, b) => String(a.generated_at || '').localeCompare(String(b.generated_at || ''))) // oldest first
          .slice(0, limit)

  if (!targets.length) {
    return NextResponse.json({ ok: false, error: 'No categories to generate. Run seed or add a category first.' }, { status: 400 })
  }

  const results: Array<{ key: string; ok: boolean; status?: number }> = []
  for (const t of targets) {
    const gen = await generateCatalogEntry({
      requestUrl: req.url,
      entry: { key: t.key, label: t.label, kind: t.kind },
      maxSearchResults: 6,
    })
    db = upsertCatalogCategory(db, gen.entry)
    results.push({ key: t.key, ok: Boolean(gen.ok) && Array.isArray(gen.entry.providers) && gen.entry.providers.length > 0, status: gen.status })
  }

  const saved = await writeCategoryCatalog(db)
  return NextResponse.json({ ok: true, updated_at: db.updated_at, storage: saved.storage, summary: summarizeCatalog(db), results })
}


