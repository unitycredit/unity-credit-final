import type { NextRequest } from 'next/server'
import { readBilling } from '@/lib/billing-store'
import { createClient } from '@/lib/supabase'

/**
 * Billing / access utilities stub.
 *
 * Some async job endpoints use this for premium gating.
 * For now:
 * - In dev: allow access (so features can be demoed end-to-end).
 * - In production: deny unless you replace with real billing checks.
 */
export async function hasPaidAccess(_req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true as const, access: true as const, ident: { user_id: 'dev-user' } }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return { ok: false as const, access: false as const, ident: null }

    const db = await readBilling()
    const s = db.subscribers?.[user.id]
    const now = Date.now()
    const premiumUntil = Date.parse(String(s?.premium_until || ''))
    const trialUntil = Date.parse(String((s as any)?.trial_until || ''))

    const access =
      (Boolean(s?.premium_active) && Number.isFinite(premiumUntil) && premiumUntil > now) ||
      (Boolean((s as any)?.trial_active) && Number.isFinite(trialUntil) && trialUntil > now)

    return { ok: true, access: Boolean(access), ident: { user_id: user.id } } as const
  } catch {
    return { ok: false as const, access: false as const, ident: null }
  }
}


