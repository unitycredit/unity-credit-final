import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { readBilling, writeBilling } from '@/lib/billing-store'

function addDaysIso(days: number) {
  const d = new Date(Date.now() + Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const demo = Boolean(body?.demo)
  const paymentMethodId = String(body?.payment_method_id || '').trim()
  if (!demo && !paymentMethodId) return NextResponse.json({ ok: false, error: 'Missing payment method' }, { status: 400, headers: rl.headers })

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

  db.subscribers[userId] = {
    user_id: userId,
    created_at: createdAt,
    premium_active: Boolean(prev?.premium_active),
    premium_until: prev?.premium_until || null,
    total_paid_cents: Number(prev?.total_paid_cents) || 0,
    trial_active: true,
    trial_until: addDaysIso(7),
  }

  await writeBilling(db)

  return NextResponse.json({ ok: true }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


