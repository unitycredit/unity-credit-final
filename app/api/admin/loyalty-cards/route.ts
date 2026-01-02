import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readLoyaltyDB, upsertCard, writeLoyaltyDB, type LoyaltyCardKey } from '@/lib/loyalty-cards'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const db = await readLoyaltyDB()
  return NextResponse.json({ ok: true, db })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const key = String(body?.key || '').trim() as LoyaltyCardKey
  if (key !== 'evercard' && key !== 'bingo_membership' && key !== 'target_redcard') {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const pointsRaw = body?.points
  const points = pointsRaw === null || pointsRaw === undefined || pointsRaw === '' ? null : Number(pointsRaw)
  if (points !== null && !Number.isFinite(points)) return NextResponse.json({ error: 'Invalid points' }, { status: 400 })

  const member_id_last4 = sanitizeInput(String(body?.member_id_last4 || '')).trim().slice(0, 12) || null
  const notes = sanitizeInput(String(body?.notes || '')).trim().slice(0, 500) || null

  const db = await readLoyaltyDB()
  const next = upsertCard(db, { key, points: points === null ? null : Math.max(0, Math.floor(points)), member_id_last4, notes })
  const saved = await writeLoyaltyDB(next)
  return NextResponse.json({ ok: true, storage: saved.storage, db: next })
}


