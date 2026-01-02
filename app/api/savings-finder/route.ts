import { NextRequest, NextResponse } from 'next/server'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { sanitizeInput } from '@/lib/security'
import { createClient } from '@/lib/supabase'
import { webSearch } from '@/lib/web-search'
import { createHash } from 'node:crypto'
import { upstashEnabled, upstashCmd } from '@/lib/upstash'
import { createAdminClient } from '@/lib/supabase-admin'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { getAccountGovernanceStatus, detectBusinessInventoryIntentFromText } from '@/lib/account-governance'
import { cleanTransactionForGrouping } from '@/lib/finance/transaction-cleaning'
import {
  computeSavingsFromPct,
  findActiveLibraryRow,
  findActiveLibraryRowsBatch,
  normalizeMerchant,
  recurringBillAboveCommunityAverage,
  upsertDealPattern,
  upsertRecurringBenchmark,
} from '@/lib/unity-deals-library'
import { decryptPayload, findVaultAdviceBatch, upsertVaultAdvice } from '@/lib/vault'

type RecurringBill = {
  merchant: string
  category: 'insurance' | 'phone' | 'utilities' | 'internet' | 'subscription' | 'other'
  occurrences: number
  monthly_estimate: number
  last_date?: string
}

type SavingsRecommendation = {
  title_yi: string
  category: RecurringBill['category']
  merchant?: string
  monthly_savings: number
  provider_name?: string
  provider_url?: string
  email_subject_yi?: string
  email_body_yi?: string
  target_budget_key?: string
}

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyMerchant(text: string): RecurringBill['category'] {
  const t = norm(text)
  const has = (arr: string[]) => arr.some((k) => t.includes(k))
  if (has(['insurance', 'geico', 'progressive', 'state farm', 'allstate', 'liberty mutual', 'policy', 'premium'])) return 'insurance'
  if (has(['verizon', 't mobile', 'tmobile', 'at t', 'att', 'wireless', 'mobile', 'cellular', 'sprint'])) return 'phone'
  if (has(['con ed', 'coned', 'pseg', 'national grid', 'utility', 'utilities', 'electric', 'gas', 'water', 'sewer'])) return 'utilities'
  if (has(['internet', 'xfinity', 'comcast', 'spectrum', 'fios'])) return 'internet'
  if (has(['netflix', 'spotify', 'amazon prime', 'hulu', 'subscription', 'member', 'membership'])) return 'subscription'
  return 'other'
}

function sumMonthEstimate(amtSum: number, periodDays: number) {
  const days = Math.max(1, Number(periodDays) || 90)
  return (amtSum / days) * 30
}

function extractJsonObject(text: string): any | null {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

function buildNativeEmailDraftYI(params: { merchant: string; category: RecurringBill['category'] }) {
  const m = String(params.merchant || '').trim()
  const cat =
    params.category === 'insurance'
      ? 'אינשורענס'
      : params.category === 'phone'
      ? 'טעלעפאן/וויירלעס'
      : params.category === 'utilities'
      ? 'יוטיליטיס'
      : params.category === 'internet'
      ? 'אינטערנעט'
      : 'סובסקריפּשאַן'
  const subject = `בקשה: איבערקוקן מיין ${cat} ביל`
  const body = `שלום,

איך וויל איבערקוקן מיין ${cat} ביל/פלאן מיט אייך, און זען צי מען קען פארבעסערן דעם פרייז.

ביטע שיקט מיר:
1) א פרישע פרייז־ברעיקדאַון אויף מיין יעצטיגע פלאן
2) אפציעס פאר דיסקאונטן/פּראָמאָושאַנז
3) א בעסערע פלאן/פּעקידזש (אויב שייך) מיט די נייע פרייז

אקאונט/מערטשאַנט: ${m}

א גרויסן דאנק,
[נאמען]`
  return { subject_yi: subject, body_yi: body }
}

export async function POST(req: NextRequest) {
  try {
    // Compliance + governance gate (server-side enforcement).
    const gov = await getAccountGovernanceStatus(req).catch(() => null)
    if (gov?.blocked) {
      return NextResponse.json(
        {
          error:
            'דאס קאנטע איז צייַטווייליג ריסטריקטירט צוליב א קאנטע־באַנוץ־איבערטרעטונג. ביטע קאָנטאַקטירט סאַפּאָרט.',
          blocked: true,
          blocked_kind: 'usage_business_inventory',
        },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as any
    const disclaimer_yi = sanitizeInput(String(body?.disclaimer_yi || '')).trim()
    const userQuestion = sanitizeInput(String(body?.question || '')).trim()

    // Block explicit resale / business inventory guidance requests (policy).
    const invIntent = detectBusinessInventoryIntentFromText(userQuestion)
    if (invIntent.flagged) {
      return NextResponse.json(
        {
          error:
            'בלאָקירט לויט פּאָליסי: Unity Credit איז נאר פאר פּערזענליכע פינאנצן, נישט פאר ביזנעס־אינווענטאר/ריסייל עצות.',
          blocked: true,
          blocked_kind: 'usage_business_inventory',
          reasons: invIntent.reasons,
        },
        { status: 403 }
      )
    }

    // Core requirement: Savings Finder is user-scoped (never analyzes other users' Plaid connections).
    const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id || null
    if (!userId) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

    const clientId = process.env.PLAID_CLIENT_ID
    const plaidSecret = process.env.PLAID_SECRET
    if (!clientId || !plaidSecret) {
      return NextResponse.json({ error: 'סיסטעם קאנפיגוראציע פעלט (Plaid).' }, { status: 500 })
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
        headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': plaidSecret },
        // Prevent long-hanging requests (axios option used by Plaid SDK).
        timeout: 12_000,
      } as any,
    })
    const plaid = new PlaidApi(config)

    const items = await readStoredPlaidTokens({ user_id: userId })
    if (!items.length) {
      return NextResponse.json(
        {
          error:
            'קיין פארבונדן באנק איז נישט געפונען. ביטע פארבינדט א באנק (אדער נוצט Demo Bank) כדי מיר זאלן קענען אנאליזירן רעקארירנדע בילס.',
        },
        { status: 400 }
      )
    }

    const end = new Date()
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
    const start_date = start.toISOString().slice(0, 10)
    const end_date = end.toISOString().slice(0, 10)
    const period_days = 90

    // Fast-path cache (Upstash Redis). We only cache the final calculated result + parsed recs (no raw transactions).
    // Key is derived from stored item ids + date window so we don't leak bank details in cache keys.
    const cacheEnabled = upstashEnabled()
    const cacheKey = cacheEnabled
      ? (() => {
          const ids = items.map((i) => i.item_id).sort().join('|')
          const base = `${ids}|${start_date}|${end_date}`
          return `uc:cache:savings_finder:${createHash('sha256').update(base).digest('hex')}`
        })()
      : null

    if (cacheEnabled && cacheKey && !userQuestion) {
      const cached = await upstashCmd<string>(['GET', cacheKey]).catch(() => null)
      const raw = String((cached as any)?.result || '')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          return NextResponse.json({ ...parsed, cached: true })
        } catch {
          // ignore cache decode errors
        }
      }
    }

    const txAll: Array<{ name: string; merchant: string; merchant_key: string; amount: number; date: string }> = []
    for (const it of items) {
      try {
        // Paginate (Plaid may return >500 tx in 90 days). Cap pages to avoid runaway runtime.
        const pageSize = 250
        const maxPages = 12 // up to 3000 tx per item for this window
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
        const transactions = tx.data.transactions || []
          total = Number((tx.data as any)?.total_transactions || transactions.length || 0)
        for (const t of transactions) {
          const amt = Number((t as any)?.amount) || 0
          if (amt < 0) continue // ignore income
          const merchant = String((t as any)?.merchant_name || (t as any)?.name || '')
          const name = String((t as any)?.name || '')
          const date = String((t as any)?.date || '')

            // Data cleaning before any grouping/insights context to reduce merchant explosion.
            const cleaned = cleanTransactionForGrouping({ merchant, name })
            txAll.push({
              name: cleaned.label,
              merchant: cleaned.label,
              merchant_key: cleaned.label_key,
              amount: amt,
              date,
            })
          }
          offset += pageSize
          pages += 1
          if (!transactions.length) break
        }
      } catch {
        // ignore failing items in dev
      }
    }

    if (!txAll.length) {
      return NextResponse.json(
        { error: 'קיין טראַנזאַקציעס זענען נישט געפונען צו אנאליזירן. פרובירט נאכאמאל נאך א סינק.' },
        { status: 404 }
      )
    }

    // Group by merchant/name (best-effort)
    const groups = new Map<string, { label: string; sum: number; count: number; last: string }>()
    for (const t of txAll) {
      const label = (t.merchant || t.name || '').trim()
      if (!label) continue
      const key = String(t.merchant_key || norm(label)).slice(0, 80)
      if (!key) continue
      const prev = groups.get(key)
      const last = prev?.last ? (t.date > prev.last ? t.date : prev.last) : t.date
      groups.set(key, {
        label: prev?.label || label,
        sum: (prev?.sum || 0) + (Number(t.amount) || 0),
        count: (prev?.count || 0) + 1,
        last,
      })
    }

    const recurring: RecurringBill[] = Array.from(groups.values())
      .filter((g) => g.count >= 2 && g.sum > 0)
      .map((g) => {
        const monthly_estimate = Math.round(sumMonthEstimate(g.sum, period_days))
        return {
          merchant: g.label,
          category: classifyMerchant(g.label),
          occurrences: g.count,
          monthly_estimate,
          last_date: g.last || undefined,
        }
      })
      .sort((a, b) => b.monthly_estimate - a.monthly_estimate)
      .slice(0, 30)

    const focus = recurring.filter((r) => ['insurance', 'phone', 'utilities', 'internet'].includes(r.category))

    // Optional: load stored provider catalog (admin-generated) for better matching.
    let catalog: any = null
    if (upstashEnabled()) {
      const cached = await upstashCmd<string>(['GET', 'uc:catalog:latest']).catch(() => null)
      const raw = String((cached as any)?.result || '')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          catalog = parsed?.row?.payload || null
        } catch {
          catalog = null
        }
      }
    }

    if (!catalog) {
      const table = String(process.env.OPTIMIZATION_TABLE_NAME || 'optimization')
      const admin = createAdminClient()
      if (admin) {
        const { data } = await admin
          .from(table)
          .select('payload,created_at')
          .eq('kind', 'heimishe_catalog')
          .order('created_at', { ascending: false })
          .limit(1)
        const row = Array.isArray(data) ? data[0] : null
        catalog = row?.payload || null
      }
    }

    // Optional live web search (price comparisons) — disabled in the Shell.
    const searchQueries = focus.slice(0, 4).map((b) => {
      const merchant = sanitizeInput(String(b.merchant || '')).slice(0, 80)
      const cat = b.category
      const catHint =
        cat === 'insurance'
          ? 'cheaper insurance alternatives'
          : cat === 'phone'
          ? 'cheaper phone plan alternatives'
          : cat === 'utilities'
          ? 'cheaper utilities plan alternatives'
          : 'cheaper internet plan alternatives'
      return `${catHint} vs ${merchant} price per month`
    })

    const searchPacks = await Promise.all(
      searchQueries.map(async (q) => {
        const res = await webSearch(q)
        return { query: q, provider: res.provider, ok: res.ok, results: res.results }
      })
    )

    const question =
      userQuestion ||
      `ביטע מאך א "Unity Savings Finder" אנאליז.

איך וועל דיר געבן א ליסטע פון ריקיורינג בילס (לויט Plaid טראַנזאַקציעס) מיט שאצונג $/חודש.

אויב דו זעסט "LIVE SEARCH RESULTS" אונטן, נוצ זיי פאר פרייז-קאמפעריזאַנז. ניץ נאר URLs וואס זענען דאָרט; אויב נישט זיכער, לאז provider_url ליידיק.

דיין אויסגאבע מוז זיין STRICT JSON ערשט (און נאכדעם קענט איר לייגן דעם דיסקליימער-שורה).

JSON schema:
{
  "summary_yi": string,
  "recommendations": Array<{
    "title_yi": string,                       // למשל: "טויש אינשורענס & שפּאָר $60/חודש"
    "category": "insurance"|"phone"|"utilities"|"internet"|"subscription"|"other",
    "merchant": string,
    "monthly_savings": number,                // positive dollars per month
    "provider_name": string,                  // cheaper alternative provider (best-effort)
    "provider_url": string,                   // link user can open (best-effort)
    "email_subject_yi": string,               // subject for a draft email to renegotiate/cancel
    "email_body_yi": string,                  // body for a draft email
    "target_budget_key": string               // suggested budget key to apply savings (e.g. utilities, phoneInternet, subscriptions, healthInsurance)
  }>
}

Rules:
- מינימום 5 recommendations, און 8 אויב מעגלעך.
- יעדע recommendation מוז האבן monthly_savings און title_yi.
- געב "One‑Click" אקשן: אדער א provider_url אדער (email_subject_yi + email_body_yi) (בעסער ביידע).
- קיינמאל נישט פרעגן פאר SSN/DOB אדער סענסיטיווע דאקומענטן.
- שרייב אין יידיש (היימיש).`

    const context = {
      disclaimer_yi,
      bank: {
        period_days,
        transactions_count: txAll.length,
      },
      recurring_bills: focus,
      recurring_bills_all: recurring,
      catalog,
      live_search: {
        enabled: false,
        results: searchPacks,
      },
    }

    // ---------------------------------------------------------------------
    // Native matching (Unity Deals Library) — "owns the knowledge בעצם"
    // ---------------------------------------------------------------------
    // Build library-backed recs first. If we have enough signal, skip engine calls.
    const nativeRecs: SavingsRecommendation[] = []
    const seenKeys = new Set<string>()

    // ---------------------------------------------------------------------
    // Vault-first matching (Unity Savings Vault) — bypass engine entirely on match
    // ---------------------------------------------------------------------
    // We look for pre-encrypted, internally-owned advice per category+merchant.
    // If enough matches exist, we return immediately (no external model calls).
    const focusMerchantNorms = focus.map((b) => normalizeMerchant(String(b.merchant || ''))).filter(Boolean)
    const vaultRecs: SavingsRecommendation[] = []
    for (const cat of Array.from(new Set(focus.map((b) => (b.category || 'other') as any)))) {
      const rows = await findVaultAdviceBatch({ category: cat, merchant_norms: focusMerchantNorms }).catch(() => [])
      for (const r of rows as any[]) {
        try {
          const expectedAad = `unity_savings_vault:advice:v1:${String(cat)}:${String(r.merchant_norm || '')}`
          const payload = decryptPayload(String(r.encrypted_payload || ''), { expectedAad }) as any
          if (!payload?.title_yi || !(Number(payload?.monthly_savings) > 0)) continue
          vaultRecs.push({
            title_yi: String(payload.title_yi).trim(),
            category: cat,
            merchant: String(r.merchant || '').trim() || undefined,
            monthly_savings: Number(payload.monthly_savings) || 0,
            provider_name: payload.provider_name || undefined,
            provider_url: payload.provider_url || undefined,
            email_subject_yi: payload.email_subject_yi || undefined,
            email_body_yi: payload.email_body_yi || undefined,
            target_budget_key: payload.target_budget_key || undefined,
          })
        } catch {
          // ignore decrypt errors
        }
      }
    }

    if (vaultRecs.length >= 5 && !userQuestion) {
      const payload = {
        ok: true,
        recurring_bills: focus,
        recurring_bills_all: recurring,
        final: '',
        summary_yi: 'די רעקאָמענדאַציעס זענען ארויסגענומען פון Unity Savings Vault (אייגענע אינטעליגענץ־דאטא), אָן קיין דרויסנדיגע סערוויסן.',
        recommendations: vaultRecs
          .sort((a, b) => (Number(b.monthly_savings) || 0) - (Number(a.monthly_savings) || 0))
          .slice(0, 12),
        verified: true,
        verification: { source: 'vault', note: 'Matched from unity_savings_vault' },
      }
      if (cacheEnabled && cacheKey) {
        await upstashCmd(['SETEX', cacheKey, 600, JSON.stringify(payload)]).catch(() => null)
      }
      return NextResponse.json(payload)
    }

    const focusCats = Array.from(new Set(focus.map((b) => (b.category || 'other') as any)))
    const dealRows = await findActiveLibraryRowsBatch({ kind: 'deal', categories: focusCats, merchant_norms: focusMerchantNorms }).catch(() => [])
    const benchRows = await findActiveLibraryRowsBatch({ kind: 'recurring_benchmark', categories: focusCats, merchant_norms: focusMerchantNorms }).catch(
      () => []
    )
    const dealMap = new Map<string, any>()
    const benchMap = new Map<string, any>()
    for (const r of dealRows as any[]) dealMap.set(`${String(r.category)}:${String(r.merchant_norm)}`, r)
    for (const r of benchRows as any[]) benchMap.set(`${String(r.category)}:${String(r.merchant_norm)}`, r)

    for (const b of focus) {
      const cat = (b.category || 'other') as any
      const merchant = String(b.merchant || '').trim()
      if (!merchant) continue
      const merchant_norm = normalizeMerchant(merchant)
      if (!merchant_norm) continue

      // 1) Benchmarks: flag if current bill is 15% above community average
      const bench = benchMap.get(`${String(cat)}:${merchant_norm}`) || null
      if (bench?.avg_monthly_price) {
        const chk = recurringBillAboveCommunityAverage({
          monthly_estimate: b.monthly_estimate,
          community_avg_monthly: Number(bench.avg_monthly_price),
          threshold_pct: 0.15,
        })
        if (chk.flagged && chk.delta > 0) {
          const key = `bench:${cat}:${merchant_norm}`
          if (!seenKeys.has(key)) {
            const draft = buildNativeEmailDraftYI({ merchant, category: b.category })
            nativeRecs.push({
              title_yi: `דיין ביל איז הויכער ווי דער קהילות־דורכשניט — קענט שפארן בערך $${chk.delta}/חודש`,
              category: b.category,
              merchant,
              monthly_savings: chk.delta,
              email_subject_yi: draft.subject_yi,
              email_body_yi: draft.body_yi,
              target_budget_key: b.category === 'utilities' ? 'utilities' : b.category === 'phone' || b.category === 'internet' ? 'phoneInternet' : 'subscriptions',
            })
            seenKeys.add(key)
          }
        }
      }

      // 2) Deal patterns: compute savings from cached % pattern
      const pat = dealMap.get(`${String(cat)}:${merchant_norm}`) || null
      if (pat?.saving_pct) {
        const savings = computeSavingsFromPct(b.monthly_estimate, Number(pat.saving_pct))
        if (savings > 0) {
          const key = `deal:${cat}:${merchant_norm}`
          if (!seenKeys.has(key)) {
            const draft = buildNativeEmailDraftYI({ merchant, category: b.category })
            nativeRecs.push({
              title_yi: `א קאנפיגורירטע דיל־פּאַטערן פאר ${merchant} — קענט שפארן בערך $${savings}/חודש`,
              category: b.category,
              merchant,
              monthly_savings: savings,
              provider_name: undefined,
              provider_url: undefined,
              email_subject_yi: draft.subject_yi,
              email_body_yi: draft.body_yi,
              target_budget_key: b.category === 'utilities' ? 'utilities' : b.category === 'phone' || b.category === 'internet' ? 'phoneInternet' : 'subscriptions',
            })
            seenKeys.add(key)
          }
        }
      }
    }

    // If we have enough native recs, return without spending any model calls.
    if (nativeRecs.length >= 5 && !userQuestion) {
      const payload = {
        ok: true,
        recurring_bills: focus,
        recurring_bills_all: recurring,
        final: '',
        summary_yi: 'די רעקאָמענדאַציעס זענען צוזאַמענגענומען פון דער Unity Deals Library (אייגענע דאטא־באַזע).',
        recommendations: nativeRecs
          .sort((a, b) => (Number(b.monthly_savings) || 0) - (Number(a.monthly_savings) || 0))
          .slice(0, 12),
        verified: true,
        verification: { source: 'library', note: 'Matched from unity_deals_library' },
      }

      if (cacheEnabled && cacheKey) {
        await upstashCmd(['SETEX', cacheKey, 600, JSON.stringify(payload)]).catch(() => null) // 10 minutes
      }
      return NextResponse.json(payload)
    }

    // Call the internal intelligence endpoint (server-to-server) so we keep logic centralized
    const url = new URL('/api/logic/process', req.url)
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context }),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return NextResponse.json({ error: json?.error || 'Intelligence service failed', details: json }, { status: resp.status })
    }

    const finalText = String(json?.final || '')
    const parsed = extractJsonObject(finalText)
    const recsRaw = parsed?.recommendations
    const recommendations: SavingsRecommendation[] = Array.isArray(recsRaw)
      ? recsRaw
          .map((r: any) => ({
            title_yi: String(r?.title_yi || '').trim(),
            category: (String(r?.category || 'other') as any) || 'other',
            merchant: String(r?.merchant || '').trim() || undefined,
            monthly_savings: Number(r?.monthly_savings) || 0,
            provider_name: String(r?.provider_name || '').trim() || undefined,
            provider_url: String(r?.provider_url || '').trim() || undefined,
            email_subject_yi: String(r?.email_subject_yi || '').trim() || undefined,
            email_body_yi: String(r?.email_body_yi || '').trim() || undefined,
            target_budget_key: String(r?.target_budget_key || '').trim() || undefined,
          }))
          .filter((r: SavingsRecommendation) => r.title_yi && r.monthly_savings > 0)
          .slice(0, 12)
      : []

    // Cache new proprietary patterns (best-effort, service-role only).
    // Rule: only store when node verification is strong (>=4 approvals out of 5).
    try {
      const approvals = Number(json?.verification?.approvals || 0)
      if (approvals >= 4) {
        // 1) Recurring benchmarks: store community average monthly price per merchant/category
        // We use the current user's observed monthly_estimate as one sample into the rolling average.
        for (const b of recurring) {
          const cat = (b.category || 'other') as any
          const m = String(b.merchant || '').trim()
          if (!m || !(Number(b.monthly_estimate) > 0)) continue
          await upsertRecurringBenchmark({
            category: cat,
            merchant: m,
            avg_monthly_price: Number(b.monthly_estimate),
            source: 'engine',
            meta: { from: 'savings_finder', period_days, occurrences: b.occurrences },
          }).catch(() => null)
        }

        // 2) Deal patterns: derive saving_pct from engine output and user monthly_estimate
        const byMerchant = new Map<string, RecurringBill>()
        for (const b of recurring) {
          const k = normalizeMerchant(String(b.merchant || ''))
          if (k) byMerchant.set(k, b)
        }
        for (const r of recommendations) {
          const m = String(r.merchant || '').trim()
          const k = normalizeMerchant(m)
          const bill = k ? byMerchant.get(k) : null
          if (!bill || !(bill.monthly_estimate > 0)) continue
          const pct = (Number(r.monthly_savings) || 0) / Number(bill.monthly_estimate)
          if (!(pct > 0)) continue
          await upsertDealPattern({
            category: (r.category || 'other') as any,
            merchant: bill.merchant,
            saving_pct: pct,
            source: 'engine',
            meta: { from: 'savings_finder', request_verified: true, approvals },
          }).catch(() => null)

          // Also store a vault "advice" record (encrypted) for future bypass.
          await upsertVaultAdvice({
            category: (r.category || 'other') as any,
            merchant: bill.merchant,
            payload: {
              v: 1,
              title_yi: String(r.title_yi || '').trim(),
              monthly_savings: Number(r.monthly_savings) || 0,
              email_subject_yi: r.email_subject_yi || null,
              email_body_yi: r.email_body_yi || null,
              provider_name: r.provider_name || null,
              provider_url: r.provider_url || null,
            },
          }).catch(() => null)
        }
      }
    } catch {
      // ignore caching errors
    }

    const payload = {
      ok: true,
      recurring_bills: focus,
      recurring_bills_all: recurring,
      final: finalText,
      summary_yi: String(parsed?.summary_yi || '').trim() || null,
      // Merge: vault recs first (if any), then native recs, then engine recs.
      recommendations: (() => {
        const all = [...vaultRecs, ...nativeRecs, ...recommendations]
        const out: SavingsRecommendation[] = []
        const seen = new Set<string>()
        for (const r of all) {
          const cat = String(r.category || 'other')
          const mk = normalizeMerchant(String(r.merchant || ''))
          const k = `${cat}:${mk}:${String(r.title_yi || '').slice(0, 60)}`
          if (seen.has(k)) continue
          seen.add(k)
          out.push(r)
        }
        return out.sort((a, b) => (Number(b.monthly_savings) || 0) - (Number(a.monthly_savings) || 0)).slice(0, 12)
      })(),
      verified: Boolean(json?.verified) || nativeRecs.length > 0 || vaultRecs.length > 0,
      verification: { ...(json?.verification || {}), library_used: nativeRecs.length > 0, vault_used: vaultRecs.length > 0 },
    }

    // Enterprise scale: persist a safe snapshot for the authenticated user (no raw transactions).
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      const userId = data?.user?.id || null
      if (userId) {
        const admin = createAdminClient()
        if (admin) {
          await admin.from('user_savings_snapshots').insert({
            user_id: userId,
            kind: 'savings_finder',
            payload: {
              summary_yi: payload.summary_yi,
              recommendations: payload.recommendations,
              verified: payload.verified,
              verification: payload.verification,
            },
          } as any)
        }
      }
    } catch {
      // ignore
    }

    if (cacheEnabled && cacheKey && !userQuestion) {
      await upstashCmd(['SETEX', cacheKey, 600, JSON.stringify(payload)]).catch(() => null) // 10 minutes
    }

    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Savings Finder error' }, { status: 500 })
  }
}


