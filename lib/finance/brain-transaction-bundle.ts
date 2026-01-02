import 'server-only'

import { createClient } from '@/lib/supabase'
import { cleanTransactionForGrouping } from '@/lib/finance/transaction-cleaning'

export type BrainTransactionRow = {
  occurred_on: string
  amount: number
  direction: 'outflow' | 'inflow'
  currency: string
  category: string | null
  merchant: string
  merchant_key: string
  name_raw?: string
}

export type BrainTransactionBundle = {
  window_days: number
  generated_at: string
  totals: {
    tx_count: number
    outflow_total: number
    inflow_total: number
    currency: string
  }
  top_merchants: Array<{ merchant: string; spend: number; tx_count: number }>
  top_categories: Array<{ category: string; spend: number; tx_count: number }>
  transactions: BrainTransactionRow[]
}

function isoDateDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100
}

export async function buildLast30DaysTransactionBundle(params: { user_id: string; limit?: number }): Promise<BrainTransactionBundle> {
  const userId = String(params.user_id || '').trim()
  const limit = Math.max(1, Math.min(5000, Number(params.limit || 1200)))
  const since = isoDateDaysAgo(30)

  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('plaid_transactions')
    .select('amount,currency,category_primary,merchant_name,name,occurred_on')
    .eq('user_id', userId)
    .gte('occurred_on', since)
    .order('occurred_on', { ascending: false })
    .limit(limit)

  const tx = Array.isArray(rows) ? (rows as any[]) : []

  let outflowTotal = 0
  let inflowTotal = 0
  const byMerchant = new Map<string, { merchant: string; spend: number; tx: number }>()
  const byCategory = new Map<string, { category: string; spend: number; tx: number }>()

  const transactions: BrainTransactionRow[] = tx.map((t) => {
    const amountRaw = Number((t as any)?.amount) || 0
    const category = (t as any)?.category_primary ? String((t as any).category_primary) : null
    const currency = String((t as any)?.currency || 'usd').toLowerCase()
    const occurred_on = String((t as any)?.occurred_on || '').trim() || new Date().toISOString().slice(0, 10)

    const merchantRaw = String((t as any)?.merchant_name || '').trim()
    const nameRaw = String((t as any)?.name || '').trim()
    const cleaned = cleanTransactionForGrouping({ merchant: merchantRaw || nameRaw, name: nameRaw || merchantRaw })

    const isIncome = amountRaw < 0 || String(category || '').toUpperCase() === 'INCOME'
    const direction: BrainTransactionRow['direction'] = isIncome ? 'inflow' : 'outflow'
    const amount = round2(Math.abs(amountRaw))

    const merchant = cleaned.label || merchantRaw || nameRaw || '—'
    const merchant_key = cleaned.label_key || merchant.toLowerCase().slice(0, 80)

    // Aggregate (use outflows for spend summaries)
    if (direction === 'outflow') {
      outflowTotal += amount
      const prevM = byMerchant.get(merchant_key) || { merchant, spend: 0, tx: 0 }
      prevM.spend += amount
      prevM.tx += 1
      byMerchant.set(merchant_key, prevM)

      const catKey = String(category || 'Unknown')
      const prevC = byCategory.get(catKey) || { category: catKey, spend: 0, tx: 0 }
      prevC.spend += amount
      prevC.tx += 1
      byCategory.set(catKey, prevC)
    } else {
      inflowTotal += amount
    }

    return {
      occurred_on,
      amount,
      direction,
      currency,
      category,
      merchant,
      merchant_key,
      name_raw: nameRaw || undefined,
    }
  })

  const top_merchants = Array.from(byMerchant.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 12)
    .map((x) => ({ merchant: x.merchant, spend: round2(x.spend), tx_count: x.tx }))

  const top_categories = Array.from(byCategory.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map((x) => ({ category: x.category, spend: round2(x.spend), tx_count: x.tx }))

  return {
    window_days: 30,
    generated_at: new Date().toISOString(),
    totals: {
      tx_count: transactions.length,
      outflow_total: round2(outflowTotal),
      inflow_total: round2(inflowTotal),
      currency: 'usd',
    },
    top_merchants,
    top_categories,
    transactions,
  }
}


