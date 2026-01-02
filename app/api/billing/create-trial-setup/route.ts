import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'

function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '').trim()
  if (!key) return null
  return new Stripe(key)
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

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

  const stripe = getStripe()
  if (!stripe) {
    // Environment is not wired for live Stripe. Keep UI deterministic and in demo mode.
    return NextResponse.json({ ok: true, demo: true, client_secret: 'demo_setup_secret' }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }

  try {
    const intent = await stripe.setupIntents.create({
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: { user_id: userId, plan: 'enterprise_unity_logic' },
    })

    return NextResponse.json(
      { ok: true, demo: false, client_secret: intent.client_secret },
      { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to initialize billing' },
      { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }
}


