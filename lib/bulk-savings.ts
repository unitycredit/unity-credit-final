export type BulkOffer = {
  store: string
  item: string
  price: number
  size_units: number // normalized quantity (e.g. lbs count)
}

export function unitPrice(offer: BulkOffer) {
  const denom = Number(offer.size_units) || 0
  if (!Number.isFinite(denom) || denom <= 0) return null
  const p = Number(offer.price) || 0
  if (!Number.isFinite(p) || p <= 0) return null
  return p / denom
}

export function compareBulkOffers(a: BulkOffer, b: BulkOffer) {
  const ua = unitPrice(a)
  const ub = unitPrice(b)
  if (ua === null || ub === null) return { ok: false as const, error: 'Invalid offers' }
  const winner = ua <= ub ? 'a' : 'b'
  const savingsPerUnit = Math.abs(ub - ua)
  const savingsPct = (savingsPerUnit / Math.max(ua, ub)) * 100
  return {
    ok: true as const,
    winner,
    a_unit: ua,
    b_unit: ub,
    savings_per_unit: savingsPerUnit,
    savings_pct: Math.round(savingsPct * 10) / 10,
  }
}


