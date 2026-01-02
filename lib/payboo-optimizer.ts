export type PaybooVsPointsInput = {
  item_price: number // pre-tax
  tax_rate_pct: number // e.g. 8.875
  rewards_rate_pct: number // e.g. 2.0 for 2%
  rewards_value_multiplier?: number // optional: 1.0 means face value; 1.25 means 25% uplift
}

export type PaybooVsPointsResult = {
  ok: boolean
  item_price: number
  tax_rate_pct: number
  rewards_rate_pct: number
  rewards_value_multiplier: number
  tax_savings: number
  rewards_value: number
  winner: 'payboo_tax' | 'rewards' | 'tie'
  delta: number // payboo_tax - rewards_value
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function computePaybooVsPoints(input: PaybooVsPointsInput): PaybooVsPointsResult {
  const item = Number(input.item_price)
  const taxPct = Number(input.tax_rate_pct)
  const rewardsPct = Number(input.rewards_rate_pct)
  const mult = Number(input.rewards_value_multiplier ?? 1)

  if (!Number.isFinite(item) || item <= 0) {
    return {
      ok: false,
      item_price: 0,
      tax_rate_pct: 0,
      rewards_rate_pct: 0,
      rewards_value_multiplier: 1,
      tax_savings: 0,
      rewards_value: 0,
      winner: 'tie',
      delta: 0,
    }
  }
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 20) {
    return { ...computePaybooVsPoints({ item_price: item, tax_rate_pct: 0, rewards_rate_pct: rewardsPct, rewards_value_multiplier: mult }), ok: false }
  }
  if (!Number.isFinite(rewardsPct) || rewardsPct < 0 || rewardsPct > 20) {
    return { ...computePaybooVsPoints({ item_price: item, tax_rate_pct: taxPct, rewards_rate_pct: 0, rewards_value_multiplier: mult }), ok: false }
  }
  if (!Number.isFinite(mult) || mult <= 0 || mult > 3) {
    return { ...computePaybooVsPoints({ item_price: item, tax_rate_pct: taxPct, rewards_rate_pct: rewardsPct, rewards_value_multiplier: 1 }), ok: false }
  }

  const taxSavings = round2(item * (taxPct / 100))
  const rewardsValue = round2(item * (rewardsPct / 100) * mult)
  const delta = round2(taxSavings - rewardsValue)
  const winner = Math.abs(delta) < 0.01 ? 'tie' : delta > 0 ? 'payboo_tax' : 'rewards'

  return {
    ok: true,
    item_price: round2(item),
    tax_rate_pct: round2(taxPct),
    rewards_rate_pct: round2(rewardsPct),
    rewards_value_multiplier: round2(mult),
    tax_savings: taxSavings,
    rewards_value: rewardsValue,
    winner,
    delta,
  }
}


