import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { readBilling, writeBilling } from '@/lib/billing-store'

export const runtime = 'nodejs'

function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '').trim()
  if (!key) return null
  return new Stripe(key)
}

function getOrigin(req: NextRequest) {
  const env = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (env) return env.replace(/\/$/, '')
  const h = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3002'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${h}`.replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' },
      { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

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
  if (!userId) return NextResponse.redirect(new URL('/login', getOrigin(req)))

  const db = await readBilling()
  const prev = db.subscribers?.[userId]
  let customerId = String(prev?.stripe_customer_id || '').trim()

  // Fallback: search customer by metadata if not stored (best-effort).
  if (!customerId) {
    try {
      const found = await stripe.customers.search({ query: `metadata['user_id']:'${userId}'`, limit: 1 })
      customerId = String(found.data?.[0]?.id || '').trim()
      if (customerId) {
        db.subscribers[userId] = {
          ...(db.subscribers[userId] || { user_id: userId, premium_active: false, premium_until: null }),
          user_id: userId,
          stripe_customer_id: customerId,
        }
        await writeBilling(db)
      }
    } catch {
      customerId = ''
    }
  }

  if (!customerId) {
    // No customer yet → send user to checkout first.
    return NextResponse.redirect(new URL('/api/checkout', getOrigin(req)))
  }

  const origin = getOrigin(req)
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/settings?tab=billing`,
  })

  return NextResponse.redirect(portal.url)
}


