'use client'

import { useCallback, useEffect, useState } from 'react'

type PremiumTier = 'free' | 'pro' | 'trial' | 'premium'

type PremiumStatus = {
  tier: PremiumTier
  premium_until?: string | null
  trial_until?: string | null
}

/**
 * Premium status hook stub.
 *
 * This build focuses on Unity Credit + savings automation. Premium gating can be enabled later.
 * For now we expose a stable API so PremiumGate/UpsellTrialBanner compile and render safely.
 */
export function usePremiumStatus() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<PremiumStatus>({ tier: 'free' })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Optional endpoint if/when you implement real premium billing.
      const res = await fetch('/api/premium/status').catch(() => null)
      const json = res ? await res.json().catch(() => ({})) : null
      const tier = (json?.tier as PremiumTier) || 'free'
      setStatus({ tier, premium_until: json?.premium_until || null, trial_until: json?.trial_until || null })
    } catch {
      setStatus({ tier: 'free' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Best-effort; don't block UI.
    refresh().catch(() => null)
  }, [refresh])

  return { loading, status, refresh }
}


