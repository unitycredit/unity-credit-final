// ==========================================================
// Unity Brain Core: Central Rule Engine (single source of truth)
// ==========================================================

export type CreditCard = {
  limit: number
  balance: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toFiniteNonNegativeNumber(v: any, fallback = 0) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

export type CreditSummary = {
  totalLimit: number
  totalBalance: number
  totalAvailable: number
  utilizationPct: number
  payTo30: number
}

export function computeCreditSummary(cards: CreditCard[]): CreditSummary {
  const list = Array.isArray(cards) ? cards : []
  let totalLimit = 0
  let totalBalance = 0
  for (const c of list) {
    totalLimit += toFiniteNonNegativeNumber((c as any)?.limit, 0)
    totalBalance += toFiniteNonNegativeNumber((c as any)?.balance, 0)
  }
  totalBalance = Math.min(totalBalance, totalLimit)
  const totalAvailable = Math.max(0, totalLimit - totalBalance)
  const utilizationPct = totalLimit > 0 ? clamp((totalBalance / totalLimit) * 100, 0, 100) : 0
  const payTo30 = Math.max(0, totalBalance - totalLimit * 0.3)
  return { totalLimit, totalBalance, totalAvailable, utilizationPct, payTo30 }
}

export type DebtRatioResult = {
  debtRatio: number | null
  debtRatioPct: number | null
}

export function computeDebtRatio(params: { monthlyIncome: number | null | undefined; monthlyDebtPayments: number | null | undefined }): DebtRatioResult {
  const income = params.monthlyIncome
  const debt = params.monthlyDebtPayments
  if (!Number.isFinite(income as any) || (income as number) <= 0) return { debtRatio: null, debtRatioPct: null }
  if (!Number.isFinite(debt as any) || (debt as number) < 0) return { debtRatio: null, debtRatioPct: null }
  const ratio = clamp((debt as number) / (income as number), 0, 10)
  const pct = clamp(ratio * 100, 0, 1000)
  return { debtRatio: ratio, debtRatioPct: pct }
}

export function estimateMonthlyDebtPaymentsFromCreditCards(cards: CreditCard[], params?: { minPaymentPct?: number }) {
  const list = Array.isArray(cards) ? cards : []
  const minPaymentPct = Number.isFinite(params?.minPaymentPct as any) ? Number(params?.minPaymentPct) : 0.02
  let total = 0
  for (const c of list) {
    const bal = toFiniteNonNegativeNumber((c as any)?.balance, 0)
    if (bal <= 0) continue
    total += bal * minPaymentPct
  }
  return total
}

export type BankSnapshot = {
  monthly_income?: number | null
  monthly_expenses?: number | null
  total_balance?: number | null
  accounts_count?: number | null
}

export type BudgetItemLike = {
  monthly?: number | string | null
}

function parseNumberLike(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function computeBudgetMonthlyTotalFromItems(items: BudgetItemLike[] | null | undefined) {
  const list = Array.isArray(items) ? items : []
  let total = 0
  for (const it of list) {
    const m = parseNumberLike((it as any)?.monthly)
    if (!Number.isFinite(m as any) || (m as number) <= 0) continue
    total += m as number
  }
  return total
}

export type FinanceSnapshot = {
  version: 1
  generated_at: string
  credit: CreditSummary | null
  bank: { total_balance: number | null; monthly_income: number | null; monthly_expenses: number | null; accounts_count: number | null } | null
  budget: { monthly_total: number | null } | null
  derived: { net_worth_estimate: number | null; est_monthly_debt_payments: number | null; debt_ratio_pct: number | null } | null
}

export function createFinanceSnapshot(params: { cards?: CreditCard[] | null; bank?: BankSnapshot | null; budget_items?: BudgetItemLike[] | null }): FinanceSnapshot {
  const credit = params.cards ? computeCreditSummary(params.cards) : null
  const bank = params.bank
    ? {
        total_balance: parseNumberLike(params.bank.total_balance),
        monthly_income: parseNumberLike(params.bank.monthly_income),
        monthly_expenses: parseNumberLike(params.bank.monthly_expenses),
        accounts_count: parseNumberLike(params.bank.accounts_count),
      }
    : null

  const budgetMonthlyTotal = computeBudgetMonthlyTotalFromItems(params.budget_items)
  const budget = params.budget_items ? { monthly_total: budgetMonthlyTotal } : null

  const estDebtPayments = credit ? estimateMonthlyDebtPaymentsFromCreditCards(params.cards || [], { minPaymentPct: 0.02 }) : null
  const dr = computeDebtRatio({ monthlyIncome: bank?.monthly_income ?? null, monthlyDebtPayments: estDebtPayments })
  const netWorthEstimate = typeof bank?.total_balance === 'number' && credit ? Number(bank.total_balance) - Number(credit.totalBalance) : null

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    credit,
    bank,
    budget,
    derived: {
      net_worth_estimate: Number.isFinite(netWorthEstimate as any) ? (netWorthEstimate as number) : null,
      est_monthly_debt_payments: Number.isFinite(estDebtPayments as any) ? (estDebtPayments as number) : null,
      debt_ratio_pct: dr.debtRatioPct,
    },
  }
}


