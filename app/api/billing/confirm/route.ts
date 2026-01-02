import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { readBilling, writeBilling } from '@/lib/billing-store'
import { randomUUID } from 'node:crypto'

function addDaysIso(days: number) {
  const d = new Date(Date.now() + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const demo = Boolean(body?.demo)
  const amountCents = Math.max(0, Number(body?.amount_cents || process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))

  let userId = ''
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = String(user?.id || '')
  } catch {
    userId = ''
  }
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const db = await readBilling()
  const prev = db.subscribers?.[userId]
  const createdAt = prev?.created_at || new Date().toISOString()
  const totalPaid = (Number(prev?.total_paid_cents) || 0) + amountCents

  db.subscribers[userId] = {
    user_id: userId,
    created_at: createdAt,
    premium_active: true,
    premium_until: addDaysIso(31),
    total_paid_cents: totalPaid,
    trial_active: false,
    trial_until: null,
  }

  db.payments = Array.isArray(db.payments) ? db.payments : []
  db.payments.push({
    id: randomUUID(),
    ts: new Date().toISOString(),
    user_id: userId,
    amount_cents: amountCents,
    status: 'confirmed',
    meta: { source: demo ? 'demo' : 'stripe', plan: 'enterprise_unity_logic' },
  })

  await writeBilling(db)

  return NextResponse.json({ ok: true }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


