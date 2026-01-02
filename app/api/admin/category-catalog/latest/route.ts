import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readCategoryCatalog, writeCategoryCatalog } from '@/lib/category-catalog-store'
import { defaultCategorySeeds, nowIso, type CategoryCatalogEntry } from '@/lib/category-catalog'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  let db = await readCategoryCatalog()

  // If storage is empty (fresh checkout), seed defaults so admin can immediately see category data.
  if (!Array.isArray((db as any)?.categories) || (db as any).categories.length === 0) {
    const seeds = defaultCategorySeeds()
    const entries: CategoryCatalogEntry[] = seeds.map((s) => ({
      key: s.key,
      label: s.label,
      kind: s.kind,
      updated_at: nowIso(),
      generated_at: null,
      providers: [],
      sources: [],
      raw: null,
    }))
    db = { v: 1, updated_at: nowIso(), categories: entries } as any
    await writeCategoryCatalog(db).catch(() => null)
  }

  return NextResponse.json({ ok: true, db })
}


