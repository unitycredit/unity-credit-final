import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { mapHeimishHub } from '@/lib/heimish-hubs'
import { mapStoreKey } from '@/lib/store-mapping'

type HeimisheBudgetItem = {
  key: string
  yi: string
  monthly_amount: number
}

type HeimishHubTotals = Array<{
  key: string
  label: string
  tx_count: number
  spend: number
  last_date?: string | null
}>

type MappedStoreTx = {
  store: string
  merchant: string
  amount: number
  date: string
  id?: string
}

function buildHeimishHubTotals(transactions: any[]): HeimishHubTotals {
  const totals = new Map<string, { key: string; label: string; tx: number; spend: number; last: string | null }>()

  for (const t of transactions || []) {
    const amtRaw = Number((t as any)?.amount) || 0
    if (amtRaw < 0) continue // ignore inflows

    const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').trim()
    const hub = mapHeimishHub(merchant)
    if (!hub) continue

    const prev = totals.get(hub.key) || { key: hub.key, label: hub.label, tx: 0, spend: 0, last: null as string | null }
    prev.tx += 1
    prev.spend += amtRaw

    const date = String((t as any)?.date || '').trim() || null
    if (date && (!prev.last || date > prev.last)) prev.last = date

    totals.set(hub.key, prev)
  }

  return Array.from(totals.values())
    .map((x) => ({
      key: x.key,
      label: x.label,
      tx_count: x.tx,
      spend: Math.round(x.spend),
      last_date: x.last,
    }))
    .sort((a, b) => b.spend - a.spend)
}

function buildMappedStoreTxs(transactions: any[], limit = 120): MappedStoreTx[] {
  const out: MappedStoreTx[] = []
  for (const t of transactions || []) {
    const amtRaw = Number((t as any)?.amount) || 0
    if (amtRaw < 0) continue
    const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').trim()
    const store = mapStoreKey(merchant)
    if (!store) continue
    out.push({
      store,
      merchant: merchant || store,
      amount: Math.round(amtRaw * 100) / 100,
      date: String((t as any)?.date || '').trim() || new Date().toISOString().slice(0, 10),
      id: String((t as any)?.transaction_id || '') || undefined,
    })
    if (out.length >= limit) break
  }
  return out
}

function buildHeimisheBudgetFromTransactions(transactions: any[]): HeimisheBudgetItem[] {
  const rules: Array<{ key: string; yi: string; keywords: string[] }> = [
    { key: 'mikveh', yi: 'מקוה געלט', keywords: ['mikveh', 'mikvah', 'mikve', 'מקוה', 'מיקוה'] },
    {
      key: 'scharLimud',
      yi: 'שכר לימוד',
      keywords: ['tuition', 'school', 'yeshiva', 'seminary', 'day school', 'chader', 'חדר', 'תלמוד תורה', 'שכר לימוד'],
    },
    { key: 'maaser', yi: 'מעשר', keywords: ['maaser', 'tithe', 'donation', 'donate', 'charity', 'tzedakah', 'מעשר', 'צדקה'] },
    {
      key: 'shabbosYomtov',
      yi: 'הוצאות שבת ויום טוב',
      keywords: ['shabbos', 'shabbat', 'yom tov', 'yomtov', 'pesach', 'sukkot', 'purim', 'chanukah', 'שבת', 'יום טוב', 'פסח'],
    },
    { key: 'goyte', yi: 'גויטע (פסח/חודש)', keywords: ['pesach', 'passover', 'פסח', 'matzah', 'matzo'] },
    { key: 'marriedKids', yi: 'חתונה מאכן קינדער', keywords: ['wedding', 'hall', 'cater', 'kallah', 'chosson', 'חתונה', 'שמחה'] },
    { key: 'tzedakah', yi: 'פארשידענע היימישע צדקה־הוצאות', keywords: ['tzedakah', 'charity', 'donation', 'צדקה'] },
    { key: 'insurance', yi: 'אינשורענס', keywords: ['insurance', 'policy', 'premium', 'geico', 'progressive', 'state farm', 'allstate', 'insur'] },
    // Smart labeling: kosher groceries -> Shabbos/Yom Tov bucket (best effort).
    {
      key: 'shabbosYomtov',
      yi: 'הוצאות שבת ויום טוב',
      keywords: [
        'kosher',
        'pomegranate',
        'bingo',
        'bingo wholesale',
        'evergreen',
        'rockland kosher',
        'npgs',
        'seasons',
        'kosher city',
        'seven mile',
        'butcher',
        'deli',
        'glatt',
      ],
    },
    { key: 'groceries', yi: 'עסן (גראָסעריס)', keywords: ['grocery', 'market', 'supermarket', 'food', 'produce'] },
  ]

  const totals = new Map<string, { key: string; yi: string; amount: number }>()
  for (const t of transactions || []) {
    const amtRaw = Number((t as any)?.amount) || 0
    if (amtRaw < 0) continue

    const merchant = String((t as any)?.merchant_name || '').toLowerCase()
    const name = String((t as any)?.name || '').toLowerCase()
    const pfc = (t as any)?.personal_finance_category
    const primary = String(pfc?.primary || '').toLowerCase()
    const secondary = String(pfc?.detailed || '').toLowerCase()
    const legacyCat = Array.isArray((t as any)?.category) ? String((t as any).category.join(' ')).toLowerCase() : ''
    const text = `${merchant} ${name} ${primary} ${secondary} ${legacyCat}`.trim()
    if (!text) continue

    const match = rules.find((r) => r.keywords.some((k) => text.includes(k)))
    if (!match) continue

    const prev = totals.get(match.key)?.amount || 0
    totals.set(match.key, { key: match.key, yi: match.yi, amount: prev + amtRaw })
  }

  return Array.from(totals.values())
    .map((x) => ({ key: x.key, yi: x.yi, monthly_amount: Math.round(x.amount) }))
    .sort((a, b) => b.monthly_amount - a.monthly_amount)
}

export async function runPlaidRefresh() {
  const clientId = process.env.PLAID_CLIENT_ID
  const plaidSecret = process.env.PLAID_SECRET
  const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()

  if (!clientId || !plaidSecret) {
    return { ok: false as const, error: 'Missing Plaid credentials' }
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
        'PLAID-SECRET': plaidSecret,
      },
    },
  })

  const plaid = new PlaidApi(config)
  const items = await readStoredPlaidTokens()
  if (!items.length) {
    return { ok: false as const, error: 'No Plaid connections found. Connect a bank first.' }
  }

  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const start_date = start.toISOString().slice(0, 10)
  const end_date = end.toISOString().slice(0, 10)

  const results: Array<{
    item_id: string
    summary: any
    heimishe_budget: HeimisheBudgetItem[]
    heimish_hubs?: HeimishHubTotals
    local_store_txs?: MappedStoreTx[]
  }> = []

  for (const it of items) {
    try {
      let totalBalance = 0
      let accountsCount = 0
      try {
        const bal = await plaid.accountsBalanceGet({ access_token: it.access_token })
        const accounts = (bal.data as any)?.accounts || []
        accountsCount = Array.isArray(accounts) ? accounts.length : 0
        if (Array.isArray(accounts)) {
          for (const a of accounts) {
            const current = Number((a as any)?.balances?.current)
            if (Number.isFinite(current)) totalBalance += current
          }
        }
      } catch {
        // ignore
      }

      const tx = await plaid.transactionsGet({
        access_token: it.access_token,
        start_date,
        end_date,
        options: { count: 250, offset: 0 },
      })
      const transactions = tx.data.transactions || []

      let monthlyExpenses = 0
      let monthlyIncome = 0
      const categoryTotals = new Map<string, number>()
      let insuranceEstimate = 0

      for (const t of transactions) {
        const amt = Number((t as any).amount) || 0
        const pfc = (t as any)?.personal_finance_category
        const primary = (pfc?.primary as string | undefined) || undefined
        const primaryUpper = String(primary || '').toUpperCase()
        const fallback = Array.isArray((t as any)?.category) ? (t as any).category[0] : undefined
        const fallbackUpper = String(fallback || '').toUpperCase()
        const category = (primary || fallback || 'אומבאקאנט') as string

        const isIncome = amt < 0 || primaryUpper === 'INCOME' || fallbackUpper === 'INCOME'
        if (isIncome) {
          monthlyIncome += Math.abs(amt)
          continue
        }

        monthlyExpenses += amt
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amt)

        const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').toLowerCase()
        const catLower = String(category).toLowerCase()
        if (catLower.includes('insurance') || merchant.includes('insurance')) {
          insuranceEstimate += amt
        }
      }

      const top_spend_categories = Array.from(categoryTotals.entries())
        .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

      const summary = {
        period_days: 30,
        transaction_count: transactions.length,
        monthly_expenses: Math.round(monthlyExpenses),
        monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
        total_balance: Math.round(totalBalance),
        accounts_count: accountsCount,
        top_spend_categories,
        insurance_estimate: Math.round(insuranceEstimate),
        heimish_hubs: buildHeimishHubTotals(transactions),
        local_store_txs: buildMappedStoreTxs(transactions, 140),
        last_updated: new Date().toISOString(),
      }

      results.push({
        item_id: it.item_id,
        summary,
        heimishe_budget: buildHeimisheBudgetFromTransactions(transactions),
        heimish_hubs: summary.heimish_hubs,
        local_store_txs: summary.local_store_txs,
      })
    } catch {
      // ignore failing items in dev
    }
  }

  const outDir = path.join(process.cwd(), '.data')
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(
    path.join(outDir, 'plaid_latest.json'),
    JSON.stringify({ updated_at: new Date().toISOString(), results }, null, 2),
    'utf8'
  )

  return { ok: true as const, count: results.length, results }
}


