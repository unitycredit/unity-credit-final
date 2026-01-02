import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { readBilling } from '@/lib/billing-store'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import Stripe from 'stripe'
import { authenticateWithBrain } from '@/lib/brain-handshake'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'

export const runtime = 'nodejs'

type Tier = 'free' | 'pro' | 'trial' | 'premium'

function normalizeTier(raw: unknown): Tier {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'premium' || v === 'trial' || v === 'pro') return v
  return 'free'
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  // 1) Stripe-backed status when configured.
  const stripeKey = String(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '').trim()
  const stripe = stripeKey ? new Stripe(stripeKey) : null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      // Brain confirmation gate: Pro should only unlock when the Brain is online + approved.
      // If the Brain is pending/offline, fail closed to 'free' (UI will show a graceful fallback).
      const brain = await authenticateWithBrain().catch(() => ({ state: 'error' as const }))
      if (brain.state !== 'active') {
        return NextResponse.json(
          { ok: true, tier: 'free', premium_until: null, trial_until: null, brain_state: brain.state },
          { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
        )
      }

      // DEV override: allow forcing Pro via cookie for a test user, but ONLY when Brain is active.
      const devAllowTierCookie = process.env.NODE_ENV !== 'production' && process.env.UNITYCREDIT_DEV_ALLOW_TIER_COOKIE === 'true'
      if (devAllowTierCookie) {
        const cookieTier = normalizeTier(req.cookies.get('uc_tier')?.value)
        const unlockedCookie = cookieTier === 'pro' || cookieTier === 'trial' || cookieTier === 'premium'
        if (unlockedCookie) {
          return NextResponse.json(
            { ok: true, tier: cookieTier, premium_until: null, trial_until: null, brain_state: 'active', source: 'dev_cookie' },
            { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
          )
        }
      }

      // Preferred: Brain is the central subscription authority.
      // This endpoint is Stripe-backed on the Brain side and returns { tier, premium_until, trial_until }.
      const brainSub = await callUnityBrainOffice({ path: '/v1/subscription/status', body: { user_id: user.id }, req: req as any })
      if (brainSub.ok && (brainSub.json as any)?.ok && typeof (brainSub.json as any)?.tier === 'string') {
        const tier = normalizeTier((brainSub.json as any)?.tier)
        return NextResponse.json(
          {
            ok: true,
            tier,
            premium_until: (brainSub.json as any)?.premium_until || null,
            trial_until: (brainSub.json as any)?.trial_until || null,
            brain_state: 'active',
            source: (brainSub.json as any)?.source || 'brain',
          },
          { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
        )
      }

      // Fail closed: Pro features unlock ONLY when the Brain confirms subscription status.
      return NextResponse.json(
        { ok: true, tier: 'free', premium_until: null, trial_until: null, brain_state: 'active', source: 'brain_unconfirmed' },
        { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
      )
    }
  } catch {
    // fall through to cookie-based tier
  }

  // 2) Dev/demo: cookie-based tier override (no auth required).
  const cookieTier = normalizeTier(req.cookies.get('uc_tier')?.value)
  return NextResponse.json({ ok: true, tier: cookieTier, premium_until: null, trial_until: null }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


