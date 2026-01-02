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

async function getOrCreatePriceId(stripe: Stripe) {
  const envPrice = String(process.env.STRIPE_PRICE_ID_PRO_MONTHLY || '').trim()
  if (envPrice) return envPrice

  const lookupKey = 'unitycredit_pro_monthly_1499'
  const existing = await stripe.prices.list({ active: true, lookup_keys: [lookupKey], limit: 1 }).catch(() => null)
  const hit = existing?.data?.[0]?.id
  if (hit) return hit

  // Create product + recurring price ($14.99/mo). Uses lookup_key so future calls reuse it.
  const product = await stripe.products.create(
    { name: 'UnityCredit Pro', metadata: { plan: 'pro_monthly_1499' } },
    { idempotencyKey: `uc_prod_${lookupKey}` }
  )
  const price = await stripe.prices.create(
    {
      currency: 'usd',
      unit_amount: 1499,
      recurring: { interval: 'month' },
      product: product.id,
      lookup_key: lookupKey,
      metadata: { plan: 'pro_monthly_1499' },
    },
    { idempotencyKey: `uc_price_${lookupKey}` }
  )
  return price.id
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

  // Require auth (so we can link subscription to the user).
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

  const origin = getOrigin(req)
  const successUrl = `${origin}/settings?tab=billing&checkout=success`
  const cancelUrl = `${origin}/settings?tab=billing&checkout=cancel`

  const db = await readBilling()
  const prev = db.subscribers?.[userId]
  const prevCustomerId = String(prev?.stripe_customer_id || '').trim()

  let customerId = prevCustomerId
  if (!customerId) {
    // Create a Stripe customer linked to this user.
    const customer = await stripe.customers.create(
      { metadata: { user_id: userId, app: 'unitycredit' } },
      { idempotencyKey: `uc_cus_${userId}` }
    )
    customerId = customer.id
    db.subscribers[userId] = {
      ...(db.subscribers[userId] || { user_id: userId, premium_active: false, premium_until: null }),
      user_id: userId,
      stripe_customer_id: customerId,
    }
    await writeBilling(db)
  }

  const priceId = await getOrCreatePriceId(stripe)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { user_id: userId, plan: 'pro_monthly_1499' },
    },
    metadata: { user_id: userId, plan: 'pro_monthly_1499' },
  })

  if (!session.url) {
    return NextResponse.json(
      { ok: false, error: 'Stripe did not return a checkout URL.' },
      { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.redirect(session.url)
}


