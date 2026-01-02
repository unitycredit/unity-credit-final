// ==========================================================
// DEPRECATED (Unity Credit): finance rules live in Unity Brain.
// This file intentionally contains NO formulas to avoid duplicating logic in the UI repo.
// Use `/api/finance/snapshot` (proxy to Unity Brain Office) instead.
// ==========================================================

export type CreditSummary = {
  totalLimit: number
  totalBalance: number
  totalAvailable: number
  utilizationPct: number
  payTo30: number
}

export type FinanceSnapshot = {
  version: 1
  generated_at: string
  credit: CreditSummary | null
  bank: {
    total_balance: number | null
    monthly_income: number | null
    monthly_expenses: number | null
    accounts_count: number | null
  } | null
  budget: { monthly_total: number | null } | null
  derived: {
    net_worth_estimate: number | null
    est_monthly_debt_payments: number | null
    debt_ratio_pct: number | null
  } | null
}

export function computeCreditSummary(): never {
  throw new Error('computeCreditSummary is deprecated in Unity Credit. Call /api/finance/snapshot via Unity Brain Office.')
}

export function createFinanceSnapshot(): never {
  throw new Error('createFinanceSnapshot is deprecated in Unity Credit. Call /api/finance/snapshot via Unity Brain Office.')
}


