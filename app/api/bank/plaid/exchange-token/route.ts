import { NextRequest, NextResponse } from 'next/server'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@/lib/supabase'
import { storePlaidToken } from '@/lib/plaid-token-store'
import { createAdminClient } from '@/lib/supabase-admin'
import { setBankSyncState } from '@/lib/bank-sync-state'

export const runtime = 'nodejs'

type HeimisheBudgetItem = {
  key: string
  yi: string
  monthly_amount: number
}

type TransactionPreview = {
  date: string
  merchant: string
  name: string
  amount: number
  category: string
}

type StoredPlaidItem = {
  item_id: string
  access_token: string
  updated_at: string
}

async function persistAccessTokenDev(item_id: string, access_token: string) {
  // Backwards-compatible dev fallback: store tokens locally so a scheduled refresh can run.
  const dataDir = path.join(process.cwd(), '.data')
  const filePath = path.join(dataDir, 'plaid_tokens.json')
  await fs.mkdir(dataDir, { recursive: true })

  let existing: StoredPlaidItem[] = []
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) existing = parsed
  } catch {
    // ignore
  }

  const now = new Date().toISOString()
  const next = existing.filter((x) => x && x.item_id !== item_id)
  next.push({ item_id, access_token, updated_at: now })

  await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

function buildHeimisheBudgetFromTransactions(transactions: any[]): HeimisheBudgetItem[] {
  // Heuristic mapping from Plaid transactions -> Heimishe budget categories (30-day totals)
  // Note: This is best-effort; users can still override values in the UI.
  const rules: Array<{ key: string; yi: string; keywords: string[] }> = [
    { key: 'mikveh', yi: 'מקוה געלט', keywords: ['mikveh', 'mikvah', 'mikve', 'מקוה', 'מיקוה'] },
    { key: 'scharLimud', yi: 'שכר לימוד', keywords: ['tuition', 'school', 'yeshiva', 'seminary', 'day school', 'chader', 'חדר', 'תלמוד תורה', 'שכר לימוד'] },
    { key: 'maaser', yi: 'מעשר', keywords: ['maaser', 'tithe', 'donation', 'donate', 'charity', 'tzedakah', 'מעשר', 'צדקה'] },
    { key: 'shabbosYomtov', yi: 'הוצאות שבת ויום טוב', keywords: ['shabbos', 'shabbat', 'yom tov', 'yomtov', 'pesach', 'sukkot', 'purim', 'chanukah', 'שבת', 'יום טוב', 'פסח'] },
    { key: 'goyte', yi: 'גויטע (פסח/חודש)', keywords: ['pesach', 'passover', 'פסח', 'matzah', 'matzo'] },
    { key: 'marriedKids', yi: 'חתונה מאכן קינדער', keywords: ['wedding', 'hall', 'cater', 'kallah', 'chosson', 'חתונה', 'שמחה'] },
    { key: 'tzedakah', yi: 'פארשידענע היימישע צדקה־הוצאות', keywords: ['tzedakah', 'charity', 'donation', 'צדקה'] },
    { key: 'insurance', yi: 'אינשורענס', keywords: ['insurance', 'policy', 'premium', 'geico', 'progressive', 'state farm', 'allstate', 'bop', 'insur'] },
    // Smart labeling: kosher groceries -> Shabbos/Yom Tov bucket (best effort).
    // Common kosher/heimishe supermarkets (expand as needed):
    { key: 'shabbosYomtov', yi: 'הוצאות שבת ויום טוב', keywords: ['kosher', 'pomegranate', 'bingo', 'evergreen', 'kosher city', 'seven mile', 'butcher', 'deli', 'glatt'] },
    { key: 'groceries', yi: 'עסן (גראָסעריס)', keywords: ['grocery', 'market', 'supermarket', 'food', 'produce'] },
  ]

  const totals = new Map<string, { key: string; yi: string; amount: number }>()

  for (const t of transactions || []) {
    const amtRaw = Number((t as any)?.amount) || 0
    // Ignore inflows (Plaid often uses negative for income)
    if (amtRaw < 0) continue
    const amt = amtRaw

    const merchant = String((t as any)?.merchant_name || '').toLowerCase()
    const name = String((t as any)?.name || '').toLowerCase()
    const pfc = (t as any)?.personal_finance_category
    const primary = String(pfc?.primary || '').toLowerCase()
    const secondary = String(pfc?.detailed || '').toLowerCase()
    const legacyCat = Array.isArray((t as any)?.category) ? String((t as any).category.join(' ')).toLowerCase() : ''

    const text = `${merchant} ${name} ${primary} ${secondary} ${legacyCat}`.trim()
    if (!text) continue

    let matched: { key: string; yi: string } | null = null
    for (const r of rules) {
      if (r.keywords.some((k) => text.includes(k))) {
        matched = { key: r.key, yi: r.yi }
        break
      }
    }
    if (!matched) continue

    const prev = totals.get(matched.key)
    totals.set(matched.key, {
      key: matched.key,
      yi: matched.yi,
      amount: (prev?.amount || 0) + amt,
    })
  }

  return Array.from(totals.values())
    .map((x) => ({ key: x.key, yi: x.yi, monthly_amount: Math.round(x.amount) }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const publicToken = body?.public_token as string | undefined

    if (!publicToken) {
      return NextResponse.json({ error: 'עס פעלט public_token' }, { status: 400 })
    }

    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()

    // Core requirement: Plaid connections are always tied to an authenticated user.
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const authedUserId = data?.user?.id || null
    if (!authedUserId) {
      return NextResponse.json({ error: 'ביטע לאָגט איין כדי צו פארבינדן א באנק־אקאונט.' }, { status: 401 })
    }

    // Architectural pivot:
    // Bank connection + transaction ownership are handled locally in Unity Credit.
    // We do NOT forward Plaid tokens or bank state to the Brain.

    // Record a sync attempt (best-effort).
    await setBankSyncState({
      user_id: authedUserId,
      status: 'active',
      last_sync_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
    }).catch(() => null)

    if (!clientId || !secret) {
      return NextResponse.json(
        { error: 'פלאיד־קרעדענשעלס פעלן (PLAID_CLIENT_ID / PLAID_SECRET).' },
        { status: 500 }
      )
    }

    const plaidEnv =
      envName === 'production'
        ? PlaidEnvironments.production
        : envName === 'development'
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox

    const config = new Configuration({
      basePath: plaidEnv,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
        // Prevent long-hanging requests (axios option used by Plaid SDK).
        timeout: 12_000,
      } as any,
    })

    const plaid = new PlaidApi(config)
    const resp = await plaid.itemPublicTokenExchange({ public_token: publicToken })

    // Store access token securely:
    // - Production: Supabase (service role only; RLS has no policies)
    // - Dev/Sandbox: Supabase when available, otherwise local `.data/plaid_tokens.json`
    const accessToken = resp.data.access_token
    const itemId = resp.data.item_id

    if (accessToken && itemId) {
      const stored = await storePlaidToken({ user_id: authedUserId, item_id: itemId, access_token: accessToken }).catch((e: any) => ({
        ok: false as const,
        error: e?.message || 'store failed',
      }))
      if (!stored.ok && envName === 'production') {
        await setBankSyncState({
          user_id: authedUserId,
          status: 'error',
          last_sync_at: new Date().toISOString(),
          last_error_code: 'token_store_failed',
          last_error_message: String((stored as any)?.error || 'token store failed'),
        }).catch(() => null)
        return NextResponse.json({ error: String((stored as any)?.error || 'Token store failed') }, { status: 503 })
      }
      // If service role isn't configured, fall back to dev file storage (non-prod only)
      if (!stored.ok && envName !== 'production') await persistAccessTokenDev(itemId, accessToken)
    }

    let summary: any = null
    let heimishe_budget: HeimisheBudgetItem[] | null = null
    let transactions_preview: TransactionPreview[] | null = null
    if (accessToken) {
      // Current balances (for "Final Total" KPI)
      let totalBalance = 0
      let accountsCount = 0
      let accounts: any[] = []
      try {
        const bal = await plaid.accountsBalanceGet({ access_token: accessToken })
        accounts = (bal.data as any)?.accounts || []
        accountsCount = Array.isArray(accounts) ? accounts.length : 0
        if (Array.isArray(accounts)) {
          for (const a of accounts) {
            const current = Number((a as any)?.balances?.current)
            if (Number.isFinite(current)) totalBalance += current
          }
        }
      } catch {
        // ignore balance failures; transactions can still work
      }

      // Best-effort: persist account snapshots locally (requires `plaid_accounts` table).
      try {
        const admin = createAdminClient()
        if (admin && Array.isArray(accounts) && accounts.length) {
          const accountRows = accounts
            .filter((a: any) => String(a?.account_id || '').trim())
            .slice(0, 200)
            .map((a: any) => ({
              user_id: authedUserId,
              item_id: itemId || null,
              plaid_account_id: String(a.account_id),
              name: a?.name ? String(a.name) : null,
              mask: a?.mask ? String(a.mask) : null,
              official_name: a?.official_name ? String(a.official_name) : null,
              type: a?.type ? String(a.type) : null,
              subtype: a?.subtype ? String(a.subtype) : null,
              current_balance: Number(a?.balances?.current) || 0,
              available_balance: a?.balances?.available == null ? null : Number(a?.balances?.available) || 0,
              iso_currency_code: a?.balances?.iso_currency_code ? String(a.balances.iso_currency_code).toLowerCase() : 'usd',
              updated_at: new Date().toISOString(),
            }))
          await admin.from('plaid_accounts').upsert(accountRows as any, { onConflict: 'user_id,plaid_account_id' }).catch(() => null)
        }
      } catch {
        // ignore account persistence failures
      }

      const end = new Date()
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      const start_date = start.toISOString().slice(0, 10)
      const end_date = end.toISOString().slice(0, 10)

      // Paginate (Plaid may return >250 tx in 30 days). Cap pages to avoid runaway runtime.
      const pageSize = 250
      const maxPages = 12 // up to 3000 tx for this window
      let offset = 0
      let total = Infinity
      let pages = 0
      const transactions: any[] = []
      while (offset < total && pages < maxPages) {
        const tx = await plaid.transactionsGet({ access_token: accessToken, start_date, end_date, options: { count: pageSize, offset } })
        const list = tx.data.transactions || []
        total = Number((tx.data as any)?.total_transactions || list.length || 0)
        transactions.push(...list)
        offset += pageSize
        pages += 1
        if (!list.length) break
      }

      // Persist transactions into Supabase (critical for scale + "real data" dashboards).
      // We use the admin client (service role) so users can't forge transaction history.
      const admin = createAdminClient()
      if (!admin) {
        return NextResponse.json(
          { error: 'Supabase admin key missing. Cannot save bank transactions. Set SUPABASE_SERVICE_ROLE_KEY and retry.' },
          { status: 503 }
        )
      }
      const rows = (transactions || [])
        .filter((t: any) => String(t?.transaction_id || '').trim())
        .map((t: any) => {
          const pfc = (t as any)?.personal_finance_category
          const primary = (pfc?.primary as string | undefined) || (Array.isArray(t?.category) ? t.category[0] : null)
          const detailed = (pfc?.detailed as string | undefined) || (Array.isArray(t?.category) ? t.category[1] : null)
          return {
            user_id: authedUserId,
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
          await setBankSyncState({
            user_id: authedUserId,
            status: 'error',
            last_sync_at: new Date().toISOString(),
            last_error_code: 'db_upsert_failed',
            last_error_message: error.message,
          }).catch(() => null)
          return NextResponse.json(
            { error: `Bank sync failed while saving transactions. Please retry. (${error.message})` },
            { status: 502 }
          )
        }
      }

      heimishe_budget = buildHeimisheBudgetFromTransactions(transactions)
      transactions_preview = (transactions || [])
        .filter((t: any) => Number(t?.amount || 0) > 0)
        .slice(0, 120)
        .map((t: any) => {
          const pfc = t?.personal_finance_category
          const primary = (pfc?.primary as string | undefined) || undefined
          const fallback = Array.isArray(t?.category) ? t.category[0] : undefined
          const category = String(primary || fallback || 'אומבאקאנט')
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

      // Plaid amounts are typically positive for outflows. Some institutions provide negative for inflows.
      let monthlyExpenses = 0
      let monthlyIncome = 0
      const categoryTotals = new Map<string, number>()
      let insuranceEstimate = 0

      for (const t of transactions) {
        const amt = Number(t.amount) || 0
        // Category signals for insights (best-effort; works across Plaid variants)
        const pfc = (t as any)?.personal_finance_category
        const primary = (pfc?.primary as string | undefined) || undefined
        const primaryUpper = String(primary || '').toUpperCase()
        const fallback = Array.isArray((t as any)?.category) ? (t as any).category[0] : undefined
        const fallbackUpper = String(fallback || '').toUpperCase()
        const category = (primary || fallback || 'אומבאקאנט') as string

        // Income detection:
        // - Some institutions mark inflows as negative amounts.
        // - Others provide income as positive but categorized as INCOME.
        const isIncome = amt < 0 || primaryUpper === 'INCOME' || fallbackUpper === 'INCOME'

        if (isIncome) {
          monthlyIncome += Math.abs(amt)
          continue
        }

        monthlyExpenses += amt

        const prev = categoryTotals.get(category) || 0
        categoryTotals.set(category, prev + amt)

        // Rough insurance estimate (category/merchant heuristic)
        const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').toLowerCase()
        const catLower = String(category).toLowerCase()
        if (catLower.includes('insurance') || merchant.includes('insurance')) {
          insuranceEstimate += amt
        }
      }

      // If no inflow data exists, keep income null so UI can decide how to handle.
      const top_spend_categories = Array.from(categoryTotals.entries())
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

      summary = {
        period_days: 30,
        transaction_count: transactions.length,
        monthly_expenses: Math.round(monthlyExpenses),
        monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
        total_balance: Math.round(totalBalance),
        accounts_count: accountsCount,
        top_spend_categories,
        insurance_estimate: Math.round(insuranceEstimate),
        last_updated: new Date().toISOString(),
      }

      // Mark successful sync (best-effort)
      const nowIso = new Date().toISOString()
      await setBankSyncState({
        user_id: authedUserId,
        status: 'active',
        last_sync_at: nowIso,
        last_success_at: nowIso,
        last_error_code: null,
        last_error_message: null,
      }).catch(() => null)

      // Trigger an automatic savings recompute (best-effort) so the Monthly Savings card updates without manual steps.
      // We forward cookies so the snapshot is saved for THIS user.
      try {
        const url = new URL('/api/savings-finder', request.url)
        const cookie = request.headers.get('cookie') || ''
        const ctrl = new AbortController()
        const id = setTimeout(() => ctrl.abort(), 20_000)
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
          body: JSON.stringify({ disclaimer_yi: '', question: '' }),
          cache: 'no-store',
          signal: ctrl.signal,
        }).catch(() => null)
        clearTimeout(id)
      } catch {
        // ignore
      }

      // Attach DB sync metadata for verification.
      ;(summary as any).db_upserted = rows.length
    }

    return NextResponse.json({
      item_id: resp.data.item_id,
      access_token_received: Boolean(resp.data.access_token),
      summary,
      heimishe_budget,
      transactions_preview,
    })
  } catch (e: any) {
    // If Plaid indicates re-auth is required, return a clear 403 for the UI.
    const code = String(e?.response?.data?.error_code || e?.data?.error_code || e?.error_code || '').toUpperCase()
    const message = String(e?.response?.data?.error_message || e?.message || 'Bank sync failed')
    if (code === 'ITEM_LOGIN_REQUIRED' || code === 'INVALID_ACCESS_TOKEN' || code === 'ITEM_NOT_FOUND') {
      try {
        const supabase = await createClient()
        const { data } = await supabase.auth.getUser()
        const userId = data?.user?.id || null
        if (userId) {
          await setBankSyncState({
            user_id: userId,
            status: 'reconnect_required',
            last_sync_at: new Date().toISOString(),
            last_error_code: code,
            last_error_message: message,
          }).catch(() => null)
        }
      } catch {
        // ignore
      }
      return NextResponse.json({ error: 'Re-connect Required', reconnect_required: true, code }, { status: 403 })
    }
    return NextResponse.json(
      {
        error: 'באַנק־פארבינדונג איז דורכגעפאלן. ביטע פרובירט נאכאמאל. (אוטאָמאַטישער ריטריי וועט לויפן)',
      },
      { status: 500 }
    )
  }
}


