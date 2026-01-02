import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createAdminClient } from '@/lib/supabase-admin'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { detectBusinessInventoryPattern, queueGovernanceBlockedEmail, setAccountBlocked, type AccountType } from '@/lib/account-governance'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

function hasCronAuth(req: NextRequest) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const h = String(req.headers.get('x-uc-cron-secret') || '').trim()
  return Boolean(h && h === secret)
}

function makePlaidClient() {
  const clientId = String(process.env.PLAID_CLIENT_ID || '').trim()
  const secret = String(process.env.PLAID_SECRET || '').trim()
  const envName = String(process.env.PLAID_ENV || 'sandbox').toLowerCase()
  if (!clientId || !secret) return null
  const plaidEnv =
    envName === 'production'
      ? PlaidEnvironments.production
      : envName === 'development'
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox

  const config = new Configuration({
    basePath: plaidEnv,
    baseOptions: { headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret }, timeout: 12_000 } as any,
  })
  return new PlaidApi(config)
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })
  if (!hasCronAuth(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const maxUsers = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('max_users') || 40)))
  const windowDays = Math.max(7, Math.min(60, Number(req.nextUrl.searchParams.get('window_days') || 30)))

  const admin = createAdminClient()
  const plaid = makePlaidClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500, headers: rl.headers })
  if (!plaid) return NextResponse.json({ ok: false, error: 'PLAID_CLIENT_ID/PLAID_SECRET missing' }, { status: 500, headers: rl.headers })

  // Load Plaid items and group by user_id
  const tokens = await readStoredPlaidTokens()
  const byUser = new Map<string, { access_token: string; item_id: string }>()
  for (const t of tokens) {
    const uid = String((t as any)?.user_id || '').trim()
    if (!uid) continue
    if (!t.access_token) continue
    if (!byUser.has(uid)) byUser.set(uid, { access_token: t.access_token, item_id: t.item_id })
  }

  // Pull users (best-effort); fall back to auth lookup per user_id for email.
  const { data: rows } = await admin
    .from('users')
    .select('id,email,account_type,blocked_at,blocked_reason')
    .order('id', { ascending: true })
    .limit(maxUsers)

  const users = Array.isArray(rows) ? rows : []

  const processed: any[] = []
  const blocked: any[] = []

  const end = new Date()
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const start_date = start.toISOString().slice(0, 10)
  const end_date = end.toISOString().slice(0, 10)

  for (const u of users) {
    const user_id = String((u as any)?.id || '').trim()
    if (!user_id) continue
    const account_type = String((u as any)?.account_type || '').trim() as AccountType
    const isPersonal = account_type === 'personal'
    const alreadyBlocked = Boolean((u as any)?.blocked_at)

    const token = byUser.get(user_id)
    if (!token) {
      processed.push({ user_id, ok: true, skipped: true, reason: 'no_plaid_token' })
      continue
    }
    if (!isPersonal) {
      processed.push({ user_id, ok: true, skipped: true, reason: `account_type=${account_type || 'unknown'}` })
      continue
    }
    if (alreadyBlocked) {
      processed.push({ user_id, ok: true, skipped: true, reason: 'already_blocked' })
      continue
    }

    let transactions: any[] = []
    try {
      // Paginate (avoid timeouts/runaway); we only need enough data to detect patterns.
      const pageSize = 250
      const maxPages = 6 // up to 1500 tx in the window is plenty for governance detection
      let offset = 0
      let total = Infinity
      let pages = 0
      while (offset < total && pages < maxPages) {
        const tx = await plaid.transactionsGet({
          access_token: token.access_token,
          start_date,
          end_date,
          options: { count: pageSize, offset },
        })
        const list = Array.isArray(tx.data.transactions) ? (tx.data.transactions as any[]) : []
        total = Number((tx.data as any)?.total_transactions || list.length || 0)
        transactions.push(...list)
        offset += pageSize
        pages += 1
        if (!list.length) break
      }
    } catch (e: any) {
      processed.push({ user_id, ok: false, error: e?.message || 'transactionsGet failed' })
      continue
    }

    const verdict = detectBusinessInventoryPattern(transactions)
    processed.push({ user_id, ok: true, flagged: verdict.flagged, score: verdict.score })

    if (!verdict.flagged) continue

    const reason = `Personal usage shows business inventory patterns: ${verdict.reasons.join('; ')}`
    await setAccountBlocked({ user_id, blocked_reason: reason }).catch(() => null)

    // Resolve email (prefer users.email if present; otherwise ask Supabase auth admin)
    let email = String((u as any)?.email || '').trim()
    if (!email) {
      try {
        const resp = await (admin as any).auth?.admin?.getUserById?.(user_id)
        email = String(resp?.data?.user?.email || '').trim()
      } catch {
        email = ''
      }
    }
    if (email) {
      await queueGovernanceBlockedEmail({ to: email, user_id, account_type: 'personal', reason }).catch(() => null)
    }

    blocked.push({ user_id, email: email || null, reason })
  }

  return NextResponse.json(
    { ok: true, window_days: windowDays, max_users: maxUsers, processed_count: processed.length, blocked_count: blocked.length, blocked, processed },
    { headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


