import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import {
  addWeeklySpecial,
  archiveWeeklySpecial,
  readWeeklySpecialsDB,
  writeWeeklySpecialsDB,
  type SpecialsLocation,
  type SpecialsStore,
} from '@/lib/weekly-specials'

export const runtime = 'nodejs'

function isLocation(x: string): x is SpecialsLocation {
  return x === 'williamsburg' || x === 'boro_park' || x === 'monsey' || x === 'lakewood'
}

function isStore(x: string): x is SpecialsStore {
  return x === 'Evergreen' || x === 'Bingo Wholesale' || x === 'Rockland Kosher' || x === 'NPGS' || x === 'Pomegranate' || x === 'Seasons'
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const db = await readWeeklySpecialsDB()
  return NextResponse.json({ ok: true, db })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const action = String(body?.action || 'add')

  const db = await readWeeklySpecialsDB()

  if (action === 'archive') {
    const id = sanitizeInput(String(body?.id || '')).trim()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const next = archiveWeeklySpecial(db, id)
    const saved = await writeWeeklySpecialsDB(next)
    return NextResponse.json({ ok: true, storage: saved.storage, db: next })
  }

  const locationRaw = sanitizeInput(String(body?.location || '')).trim()
  const storeRaw = sanitizeInput(String(body?.store || '')).trim()
  const item = sanitizeInput(String(body?.item || '')).trim().slice(0, 120)
  const unit = sanitizeInput(String(body?.unit || '')).trim().slice(0, 24) || null
  const size = sanitizeInput(String(body?.size || '')).trim().slice(0, 40) || null
  const notes = sanitizeInput(String(body?.notes || '')).trim().slice(0, 240) || null
  const source = sanitizeInput(String(body?.source || '')).trim().slice(0, 240) || null
  const starts_on = sanitizeInput(String(body?.starts_on || '')).trim().slice(0, 10) || null
  const ends_on = sanitizeInput(String(body?.ends_on || '')).trim().slice(0, 10) || null
  const price = Number(body?.price)

  if (!isLocation(locationRaw)) return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
  if (!isStore(storeRaw)) return NextResponse.json({ error: 'Invalid store' }, { status: 400 })
  if (!item) return NextResponse.json({ error: 'Missing item' }, { status: 400 })
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })

  const next = addWeeklySpecial(db, {
    location: locationRaw,
    store: storeRaw,
    item,
    unit,
    size,
    price: Math.round(price * 100) / 100,
    starts_on,
    ends_on,
    notes,
    source,
    archived_at: null,
  })
  const saved = await writeWeeklySpecialsDB(next)
  return NextResponse.json({ ok: true, storage: saved.storage, db: next })
}


