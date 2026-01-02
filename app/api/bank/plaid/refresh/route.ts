import { NextRequest, NextResponse } from 'next/server'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { createClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { setBankSyncState } from '@/lib/bank-sync-state'

export const runtime = 'nodejs'

type TransactionPreview = {
  date: string
  merchant: string
  name: string
  amount: number
  category: string
}

function buildSummaryFromTransactions(transactions: any[]) {
  let monthlyExpenses = 0
  let monthlyIncome = 0
  const categoryTotals = new Map<string, number>()
  let insuranceEstimate = 0

  for (const t of transactions || []) {
    const amt = Number((t as any)?.amount) || 0
    const pfc = (t as any)?.personal_finance_category
    const primary = (pfc?.primary as string | undefined) || undefined
    const primaryUpper = String(primary || '').toUpperCase()
    const fallback = Array.isArray((t as any)?.category) ? (t as any).category[0] : undefined
    const fallbackUpper = String(fallback || '').toUpperCase()
    const category = (primary || fallback || 'Unknown') as string

    const isIncome = amt < 0 || primaryUpper === 'INCOME' || fallbackUpper === 'INCOME'
    if (isIncome) {
      monthlyIncome += Math.abs(amt)
      continue
    }
    monthlyExpenses += amt
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amt)

    const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').toLowerCase()
    const catLower = String(category).toLowerCase()
    if (catLower.includes('insurance') || merchant.includes('insurance')) insuranceEstimate += amt
  }

  const top_spend_categories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  return {
    period_days: 30,
    transaction_count: Array.isArray(transactions) ? transactions.length : 0,
    monthly_expenses: Math.round(monthlyExpenses),
    monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
    top_spend_categories,
    insurance_estimate: Math.round(insuranceEstimate),
    last_updated: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  // Require auth: this is a user-scoped refresh.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'Supabase admin key missing. Cannot refresh bank transactions.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()
  if (!clientId || !secret) return NextResponse.json({ ok: false, error: 'Plaid is not configured.' }, { status: 500 })

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
      timeout: 12_000,
    } as any,
  })
  const plaid = new PlaidApi(config)

  const items = await readStoredPlaidTokens({ user_id: user.id })
  if (!items.length) {
    return NextResponse.json({ ok: false, error: 'No connected bank found. Connect a bank first.' }, { status: 400 })
  }

  // Mark sync attempt (best-effort).
  try {
    await setBankSyncState({
      user_id: user.id,
      status: 'active',
      last_sync_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
    })
  } catch (e: any) {
    console.error('Bank sync state update failed:', e?.message || e)
  }

  try {
    const end = new Date()
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    const start_date = start.toISOString().slice(0, 10)
    const end_date = end.toISOString().slice(0, 10)

    const pageSize = 250
    const maxPages = 12
    const all: any[] = []

    for (const it of items.slice(0, 3)) {
      let offset = 0
      let total = Infinity
      let pages = 0
      while (offset < total && pages < maxPages) {
        const tx = await plaid.transactionsGet({
          access_token: it.access_token,
          start_date,
          end_date,
          options: { count: pageSize, offset },
        })
        const list = tx.data.transactions || []
        total = Number((tx.data as any)?.total_transactions || list.length || 0)
        all.push(...list)
        offset += pageSize
        pages += 1
        if (!list.length) break
      }
    }

    // Best-effort: refresh account snapshots too (local DB ownership).
    try {
      const nowIso = new Date().toISOString()
      const accountsAll: any[] = []
      for (const it of items.slice(0, 3)) {
        try {
          const bal = await plaid.accountsBalanceGet({ access_token: it.access_token })
          const accounts = (bal.data as any)?.accounts || []
          if (Array.isArray(accounts)) {
            for (const a of accounts) accountsAll.push({ ...a, __item_id: it.item_id })
          }
        } catch {
          // ignore
        }
      }
      if (accountsAll.length) {
        const rows = accountsAll
          .filter((a: any) => String(a?.account_id || '').trim())
          .slice(0, 400)
          .map((a: any) => ({
            user_id: user.id,
            item_id: a?.__item_id ? String(a.__item_id) : null,
            plaid_account_id: String(a.account_id),
            name: a?.name ? String(a.name) : null,
            mask: a?.mask ? String(a.mask) : null,
            official_name: a?.official_name ? String(a.official_name) : null,
            type: a?.type ? String(a.type) : null,
            subtype: a?.subtype ? String(a.subtype) : null,
            current_balance: a?.balances?.current == null ? null : Number(a.balances.current) || 0,
            available_balance: a?.balances?.available == null ? null : Number(a.balances.available) || 0,
            iso_currency_code: a?.balances?.iso_currency_code ? String(a.balances.iso_currency_code).toLowerCase() : 'usd',
            updated_at: nowIso,
          }))
        const { data, error } = await admin.from('plaid_accounts').upsert(rows as any, { onConflict: 'user_id,plaid_account_id' })
        if (error) console.error('Supabase error:', error)
        void data
      }
    } catch {
      // ignore
    }

    const rows = all
      .filter((t: any) => String(t?.transaction_id || '').trim())
      .map((t: any) => {
        const pfc = (t as any)?.personal_finance_category
        const primary = (pfc?.primary as string | undefined) || (Array.isArray(t?.category) ? t.category[0] : null)
        const detailed = (pfc?.detailed as string | undefined) || (Array.isArray(t?.category) ? t.category[1] : null)
        return {
          user_id: user.id,
          plaid_transaction_id: String(t.transaction_id),
          amount: Number(t.amount) || 0,
          currency: String(t?.iso_currency_code || 'usd').toLowerCase(),
          name: t?.name ? String(t.name) : null,
          merchant_name: t?.merchant_name ? String(t.merchant_name) : null,
          category_primary: primary ? String(primary) : null,
          category_detailed: detailed ? String(detailed) : null,
          occurred_on: String(t?.date || '').trim() || new Date().toISOString().slice(0, 10),
        }
      })

    if (rows.length) {
      const { error } = await admin.from('plaid_transactions').upsert(rows as any, { onConflict: 'user_id,plaid_transaction_id' })
      if (error) {
        try {
          await setBankSyncState({
            user_id: user.id,
            status: 'error',
            last_sync_at: new Date().toISOString(),
            last_error_code: 'db_upsert_failed',
            last_error_message: error.message,
          })
        } catch (e: any) {
          console.error('Bank sync state update failed:', e?.message || e)
        }
        return NextResponse.json({ ok: false, error: `Failed saving transactions: ${error.message}` }, { status: 502 })
      }
    }

    const summary = buildSummaryFromTransactions(all)
    const transactions_preview: TransactionPreview[] = (all || [])
      .filter((t: any) => Number(t?.amount || 0) > 0)
      .slice(0, 120)
      .map((t: any) => {
        const pfc = (t as any)?.personal_finance_category
        const primary = (pfc?.primary as string | undefined) || undefined
        const fallback = Array.isArray(t?.category) ? t.category[0] : undefined
        const category = String(primary || fallback || 'Unknown')
        const merchant = String(t?.merchant_name || '').trim()
        const name = String(t?.name || '').trim()
        return {
          date: String(t?.date || '').trim() || new Date().toISOString().slice(0, 10),
          merchant: merchant || name || '—',
          name: name || merchant || '—',
          amount: Math.round(Number(t?.amount || 0) * 100) / 100,
          category,
        }
      })

    const nowIso = new Date().toISOString()
    try {
      await setBankSyncState({
        user_id: user.id,
        status: 'active',
        last_sync_at: nowIso,
        last_success_at: nowIso,
        last_error_code: null,
        last_error_message: null,
      })
    } catch (e: any) {
      console.error('Bank sync state update failed:', e?.message || e)
    }

    // Best-effort: recompute savings so dashboard updates immediately.
    try {
      const url = new URL('/api/savings-finder', req.url)
      const cookie = req.headers.get('cookie') || ''
      const ctrl = new AbortController()
      const id = setTimeout(() => ctrl.abort(), 20_000)
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ disclaimer_yi: '', question: '' }),
        cache: 'no-store',
        signal: ctrl.signal,
      })
      clearTimeout(id)
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, summary, transactions_preview }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    // If Plaid indicates re-auth is required, persist state and return 403.
    const code = String(e?.response?.data?.error_code || e?.data?.error_code || e?.error_code || '').toUpperCase()
    const message = String(e?.response?.data?.error_message || e?.message || 'Bank sync failed')
    if (code === 'ITEM_LOGIN_REQUIRED' || code === 'INVALID_ACCESS_TOKEN' || code === 'ITEM_NOT_FOUND') {
      try {
        await setBankSyncState({
          user_id: user.id,
          status: 'reconnect_required',
          last_sync_at: new Date().toISOString(),
          last_error_code: code,
          last_error_message: message,
        })
      } catch (e2: any) {
        console.error('Bank sync state update failed:', e2?.message || e2)
      }
      return NextResponse.json({ ok: false, error: 'Re-connect Required', reconnect_required: true, code }, { status: 403 })
    }
    try {
      await setBankSyncState({
        user_id: user.id,
        status: 'error',
        last_sync_at: new Date().toISOString(),
        last_error_code: code || 'plaid_error',
        last_error_message: message,
      })
    } catch (e2: any) {
      console.error('Bank sync state update failed:', e2?.message || e2)
    }
    return NextResponse.json({ ok: false, error: 'Bank refresh failed. Please retry.' }, { status: 500 })
  }
}
