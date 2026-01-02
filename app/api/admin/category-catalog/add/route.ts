import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { defaultCategorySeeds, emptyCatalog, normalizeKey, nowIso, type CategoryCatalogEntry } from '@/lib/category-catalog'
import { readCategoryCatalog, writeCategoryCatalog } from '@/lib/category-catalog-store'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const label = sanitizeInput(String(body?.label || '')).trim()
  const kind = String(body?.kind || 'shopping') === 'insurance' ? 'insurance' : 'shopping'
  const key = normalizeKey(String(body?.key || label))

  if (!label) return NextResponse.json({ error: 'Missing label' }, { status: 400 })
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const db = await readCategoryCatalog().catch(() => emptyCatalog())
  const exists = db.categories.find((c) => c.key === key)
  if (exists) return NextResponse.json({ ok: true, created: false, key })

  const entry: CategoryCatalogEntry = {
    key,
    label,
    kind: kind as any,
    updated_at: nowIso(),
    generated_at: null,
    providers: [],
    sources: [],
    raw: null,
  }

  const next = { ...db, categories: [entry, ...db.categories], updated_at: nowIso() }
  const saved = await writeCategoryCatalog(next)

  return NextResponse.json({ ok: true, created: true, key, storage: saved.storage, seeds: defaultCategorySeeds().length })
}


