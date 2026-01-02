import type { LoyaltyCard } from '@/lib/loyalty-cards'
import type { StoreKey } from '@/lib/local-price-index'

export type ConciergeRecommendation = {
  ok: boolean
  store: string
  store_key?: StoreKey | null
  recommended_payment: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

function findCard(cards: LoyaltyCard[], key: string) {
  return cards.find((c) => c.key === (key as any)) || null
}

export function recommendForStore(params: { store: string; store_key?: StoreKey | null; loyalty_cards: LoyaltyCard[] }) {
  const store = String(params.store || '').trim()
  const storeKey = params.store_key ?? null
  const cards = Array.isArray(params.loyalty_cards) ? params.loyalty_cards : []

  // Deterministic rules (admin-configurable later; keep it reliable for deployment).
  if (storeKey === 'evergreen') {
    const ever = findCard(cards, 'evercard')
    return {
      ok: true,
      store,
      store_key: storeKey,
      recommended_payment: ever ? 'Evercard' : 'Evercard (if available) + best rewards card',
      reason: 'Evergreen is mapped to Evercard; apply store-linked benefits first.',
      confidence: ever ? 'high' : 'medium',
    } satisfies ConciergeRecommendation
  }

  if (storeKey === 'bingo') {
    const bingo = findCard(cards, 'bingo_membership')
    return {
      ok: true,
      store,
      store_key: storeKey,
      recommended_payment: bingo ? 'Bingo Membership + best rewards card' : 'Bingo Membership (if available) + best rewards card',
      reason: 'Bulk pricing/membership benefits matter most at Bingo.',
      confidence: bingo ? 'high' : 'medium',
    } satisfies ConciergeRecommendation
  }

  if (storeKey === 'walmart') {
    return {
      ok: true,
      store,
      store_key: storeKey,
      recommended_payment: 'Best everyday rewards card (2%+ recommended)',
      reason: 'Walmart purchases are typically broad-category; use your strongest general rewards card.',
      confidence: 'medium',
    } satisfies ConciergeRecommendation
  }

  if (storeKey === 'costco') {
    return {
      ok: true,
      store,
      store_key: storeKey,
      recommended_payment: 'Best in-store rewards card accepted at Costco',
      reason: 'Costco acceptance rules vary; use the best eligible card you already have for in-store spend.',
      confidence: 'low',
    } satisfies ConciergeRecommendation
  }

  return {
    ok: true,
    store,
    store_key: storeKey,
    recommended_payment: 'Best available rewards card + applicable loyalty',
    reason: 'No specific mapping found; use your strongest rewards + any store loyalty.',
    confidence: 'low',
  } satisfies ConciergeRecommendation
}


