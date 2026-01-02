import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { readLoyaltyDB } from '@/lib/loyalty-cards'
import { mapStoreKey } from '@/lib/store-mapping'
import { recommendForStore } from '@/lib/loyalty-concierge'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const store = sanitizeInput(String(body?.store || '')).trim()
  if (!store) return NextResponse.json({ error: 'Missing store' }, { status: 400 })

  const loyalty = await readLoyaltyDB()
  const cards = Array.isArray(loyalty.cards) ? loyalty.cards : []
  const store_key = mapStoreKey(store)
  const rec = recommendForStore({ store, store_key, loyalty_cards: cards })

  return NextResponse.json({ ok: true, recommendation: rec })
}


