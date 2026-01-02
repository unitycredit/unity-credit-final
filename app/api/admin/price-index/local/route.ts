import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { readLocalPriceIndex, upsertVisitRange, writeLocalPriceIndex, type StoreKey } from '@/lib/local-price-index'

function isStoreKey(x: string): x is StoreKey {
  return x === 'bingo' || x === 'evergreen' || x === 'walmart' || x === 'costco'
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const db = await readLocalPriceIndex()
  return NextResponse.json({ ok: true, db })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const store = sanitizeInput(String(body?.store || '')).trim().toLowerCase()
  if (!isStoreKey(store)) return NextResponse.json({ error: 'Invalid store' }, { status: 400 })
  const min = Number(body?.min)
  const max = Number(body?.max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= 0 || max < min) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }
  const notes = sanitizeInput(String(body?.notes || '')).trim().slice(0, 240) || null

  const db = await readLocalPriceIndex()
  const next = upsertVisitRange(db, { store, min, max, notes })
  const saved = await writeLocalPriceIndex(next)
  return NextResponse.json({ ok: true, storage: saved.storage, db: next })
}


