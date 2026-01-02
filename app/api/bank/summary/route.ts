import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { setBankSyncState } from '@/lib/bank-sync-state'

export const runtime = 'nodejs'

function daysAgoISO(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const since = daysAgoISO(30)

  const { data: txRows, error } = await supabase
    .from('plaid_transactions')
    .select('plaid_transaction_id,amount,currency,name,merchant_name,category_primary,occurred_on,created_at')
    .eq('user_id', user.id)
    .gte('occurred_on', since)
    .order('occurred_on', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Bank transactions are not available yet. Ensure Supabase tables are installed (plaid_transactions) and reconnect your bank.',
        details: error.message,
      },
      { status: 500 }
    )
  }

  const tx = Array.isArray(txRows) ? (txRows as any[]) : []

  let monthlyExpenses = 0
  let monthlyIncome = 0
  const categoryTotals = new Map<string, number>()
  let insuranceEstimate = 0

  for (const t of tx) {
    const amt = Number(t.amount) || 0
    const cat = String(t.category_primary || 'Unknown')
    const catUpper = cat.toUpperCase()
    const merchant = String(t.merchant_name || t.name || '').toLowerCase()
    const isIncome = amt < 0 || catUpper === 'INCOME'
    if (isIncome) {
      monthlyIncome += Math.abs(amt)
      continue
    }
    monthlyExpenses += amt
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amt)
    if (cat.toLowerCase().includes('insurance') || merchant.includes('insurance')) insuranceEstimate += amt
  }

  const top_spend_categories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const transactions_preview = tx.slice(0, 120).map((t) => {
    const merchant = String(t.merchant_name || '').trim()
    const name = String(t.name || '').trim()
    return {
      date: String(t.occurred_on || '').trim() || new Date().toISOString().slice(0, 10),
      merchant: merchant || name || '—',
      name: name || merchant || '—',
      amount: Math.round((Number(t.amount) || 0) * 100) / 100,
      category: String(t.category_primary || 'Unknown'),
    }
  })

  // Best-effort balances from LOCAL DB first (plaid_accounts), then Plaid as fallback.
  let total_balance: number | undefined = undefined
  let accounts_count: number | undefined = undefined

  // 1) Local DB snapshot (preferred).
  try {
    const { data: accountsRows } = await supabase
      .from('plaid_accounts')
      .select('current_balance,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    const rows = Array.isArray(accountsRows) ? (accountsRows as any[]) : []
    if (rows.length) {
      accounts_count = rows.length
      let sum = 0
      for (const r of rows) {
        const v = Number((r as any)?.current_balance)
        if (Number.isFinite(v)) sum += v
      }
      total_balance = Math.round(sum)
    }
  } catch {
    // ignore (table may not exist yet)
  }

  // 2) Live balances from Plaid (fallback).
  try {
    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    if (clientId && secret && (total_balance == null || accounts_count == null)) {
      const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()
      const plaidEnv =
        envName === 'production'
          ? PlaidEnvironments.production
          : envName === 'development'
          ? PlaidEnvironments.development
          : PlaidEnvironments.sandbox
      const config = new Configuration({
        basePath: plaidEnv,
        baseOptions: {
          headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret },
          timeout: 10_000,
        } as any,
      })
      const plaid = new PlaidApi(config)
      const tokens = await readStoredPlaidTokens({ user_id: user.id })
      let total = 0
      let count = 0
      const sliced = tokens.slice(0, 3)
      // Parallelize with a small cap to avoid timeouts.
      const balances = await Promise.all(
        sliced.map(async (it) => {
          try {
            const bal = await plaid.accountsBalanceGet({ access_token: it.access_token })
            return (bal.data as any)?.accounts || []
          } catch {
            return []
          }
        })
      )
      for (const accounts of balances) {
        if (!Array.isArray(accounts)) continue
        count += accounts.length
        for (const a of accounts) {
          const current = Number((a as any)?.balances?.current)
          if (Number.isFinite(current)) total += current
        }
      }
      total_balance = Math.round(total)
      accounts_count = count
    }
  } catch (e: any) {
    // If Plaid indicates the user must re-auth, persist a reconnect_required state for dashboard UX.
    const code = String(e?.response?.data?.error_code || e?.data?.error_code || e?.error_code || '').toUpperCase()
    const message = String(e?.response?.data?.error_message || e?.message || 'Bank connection error')
    if (code === 'ITEM_LOGIN_REQUIRED' || code === 'INVALID_ACCESS_TOKEN' || code === 'ITEM_NOT_FOUND') {
      await setBankSyncState({
        user_id: user.id,
        status: 'reconnect_required',
        last_sync_at: new Date().toISOString(),
        last_error_code: code,
        last_error_message: message,
      }).catch(() => null)
    }
  }

  const summary = {
    period_days: 30,
    transaction_count: tx.length,
    monthly_expenses: Math.round(monthlyExpenses),
    monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
    total_balance,
    accounts_count,
    top_spend_categories,
    insurance_estimate: Math.round(insuranceEstimate),
    last_updated: new Date().toISOString(),
  }

  // Include sync state when available (drives "Re-connect Required" UI)
  let sync_state: any = null
  try {
    const { data } = await supabase
      .from('bank_sync_state')
      .select('status,last_sync_at,last_success_at,last_error_code,last_error_message,updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    sync_state = data || null
  } catch {
    sync_state = null
  }

  return NextResponse.json({ ok: true, source: 'supabase', summary, transactions_preview, sync_state }, { headers: { 'Cache-Control': 'no-store' } })
}


