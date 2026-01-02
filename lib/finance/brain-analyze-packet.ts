import 'server-only'

import { createClient } from '@/lib/supabase'
import { cleanTransactionForGrouping } from '@/lib/finance/transaction-cleaning'

export type BrainDebtCard = {
  /** Non-PII; internal category only */
  kind: 'credit_card'
  balance: number
  limit: number | null
  apr_pct: number | null
}

export type BrainAnalyzeTxn = {
  occurred_on: string
  amount: number
  direction: 'outflow' | 'inflow'
  currency: string
  category: string | null
  /** PII-safe grouping key */
  merchant_key: string
  /** Optional scrubbed hint (no long numbers/emails) */
  merchant_hint?: string | null
}

export type BrainAnalyzePacket = {
  version: 1
  generated_at: string
  window_days: number
  bank: {
    monthly_income_avg: number | null
    monthly_expenses_avg: number | null
    tx_count: number
    currency: string
  }
  debts: {
    cards: BrainDebtCard[]
    total_debt_balance: number
    max_apr_pct: number | null
  }
  transactions: BrainAnalyzeTxn[]
}

function isoDateDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function scrubPossiblePII(s: string) {
  let out = String(s || '').trim()
  if (!out) return ''
  // Remove emails
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
  // Remove long digit sequences (account numbers / references)
  out = out.replace(/\d{6,}/g, '[redacted]')
  // Keep it short
  out = out.slice(0, 60)
  return out
}

export async function buildBrainAnalyzePacket90d(params: { user_id: string; days?: number; limit?: number }): Promise<BrainAnalyzePacket> {
  const userId = String(params.user_id || '').trim()
  const windowDays = Math.max(30, Math.min(120, Number(params.days || 90)))
  const limit = Math.max(1, Math.min(5000, Number(params.limit || 2000)))
  const since = isoDateDaysAgo(windowDays)

  const supabase = await createClient()

  // Pull debts (credit cards)
  const { data: cardRows } = await supabase.from('credit_cards').select('balance,limit,apr').eq('user_id', userId)
  const cards: BrainDebtCard[] = (Array.isArray(cardRows) ? (cardRows as any[]) : []).map((c) => {
    const balance = Number((c as any)?.balance) || 0
    const limitN = Number((c as any)?.limit)
    const aprN = Number((c as any)?.apr)
    return {
      kind: 'credit_card',
      balance: round2(Math.max(0, balance)),
      limit: Number.isFinite(limitN) && limitN > 0 ? round2(limitN) : null,
      apr_pct: Number.isFinite(aprN) && aprN >= 0 && aprN <= 60 ? round2(aprN) : null,
    }
  })

  let maxApr: number | null = null
  let totalDebtBalance = 0
  for (const c of cards) {
    totalDebtBalance += Number(c.balance) || 0
    if (typeof c.apr_pct === 'number' && Number.isFinite(c.apr_pct)) maxApr = maxApr === null ? c.apr_pct : Math.max(maxApr, c.apr_pct)
  }

  // Pull transactions (PII-safe subset)
  const { data: txRows } = await supabase
    .from('plaid_transactions')
    .select('amount,currency,category_primary,merchant_name,name,occurred_on')
    .eq('user_id', userId)
    .gte('occurred_on', since)
    .order('occurred_on', { ascending: false })
    .limit(limit)

  const tx = Array.isArray(txRows) ? (txRows as any[]) : []
  let outflow = 0
  let inflow = 0

  const transactions: BrainAnalyzeTxn[] = tx.map((t) => {
    const amountRaw = Number((t as any)?.amount) || 0
    const currency = String((t as any)?.currency || 'usd').toLowerCase()
    const category = (t as any)?.category_primary ? String((t as any).category_primary) : null
    const catUpper = String(category || '').toUpperCase()

    const merchantRaw = String((t as any)?.merchant_name || '').trim()
    const nameRaw = String((t as any)?.name || '').trim()
    const cleaned = cleanTransactionForGrouping({ merchant: merchantRaw || nameRaw, name: nameRaw || merchantRaw })

    const isIncome = amountRaw < 0 || catUpper === 'INCOME'
    const direction: BrainAnalyzeTxn['direction'] = isIncome ? 'inflow' : 'outflow'
    const amount = round2(Math.abs(amountRaw))

    if (direction === 'inflow') inflow += amount
    else outflow += amount

    const merchant_hint = scrubPossiblePII(cleaned.label || merchantRaw || nameRaw)
    return {
      occurred_on: String((t as any)?.occurred_on || '').trim() || new Date().toISOString().slice(0, 10),
      amount,
      direction,
      currency,
      category,
      merchant_key: cleaned.label_key || 'unknown',
      merchant_hint: merchant_hint || null,
    }
  })

  // Convert totals to monthly averages over the window
  const months = windowDays / 30
  const monthly_income_avg = inflow > 0 ? Math.round(inflow / Math.max(1, months)) : null
  const monthly_expenses_avg = Math.round(outflow / Math.max(1, months))

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    window_days: windowDays,
    bank: {
      monthly_income_avg,
      monthly_expenses_avg,
      tx_count: transactions.length,
      currency: 'usd',
    },
    debts: {
      cards,
      total_debt_balance: Math.round(totalDebtBalance),
      max_apr_pct: maxApr,
    },
    transactions,
  }
}


