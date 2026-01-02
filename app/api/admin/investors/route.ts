import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { upstashEnabled } from '@/lib/upstash'
import { auditEncryptionEnabled, readVerificationAudit } from '@/lib/audit-trail'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'
import { readPlaidLatestSnapshot } from '@/lib/plaid-snapshot-store'

export const runtime = 'nodejs'

function sum(n: number[]) {
  return n.reduce((a, b) => a + b, 0)
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const admin = createAdminClient()

  // Supabase metrics (safe + scalable)
  let totalUsers: number | null = null
  let totalSavedMonthly: number | null = null
  if (admin) {
    try {
      const { count } = await admin.from('users').select('id', { count: 'exact', head: true })
      totalUsers = typeof count === 'number' ? count : null
    } catch {
      totalUsers = null
    }
    try {
      // Best-effort sum window (admin dashboard only). For true 500k+ aggregation, use a materialized rollup table.
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await admin
        .from('user_savings_events')
        .select('monthly_savings')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000)
      const rows = Array.isArray(data) ? (data as any[]) : []
      totalSavedMonthly = Math.round(sum(rows.map((r) => Number(r?.monthly_savings || 0) || 0)))
    } catch {
      totalSavedMonthly = null
    }
  }

  // Dev cache metrics (if present)
  let totalTransactions = 0
  let totalBalance = 0
  let institutions = 0
  try {
    const snap = await readPlaidLatestSnapshot()
    const results = Array.isArray(snap?.results) ? snap!.results : []
    institutions = results.length
    totalTransactions = Math.round(sum(results.map((r: any) => Number(r?.summary?.transaction_count || 0) || 0)))
    totalBalance = Math.round(sum(results.map((r: any) => Number(r?.summary?.total_balance || 0) || 0)))
  } catch {
    // ignore
  }

  const plaidTokens = await readStoredPlaidTokens().catch(() => [])
  const audit = await readVerificationAudit(2000).catch(() => ({ ok: true as const, storage: 'none' as const, encrypted: false, logs: [] as any[] }))
  const auditLogs = Array.isArray((audit as any)?.logs) ? ((audit as any).logs as any[]) : []

  const totalRuns = auditLogs.length
  const blockedRuns = auditLogs.filter((l: any) => l?.blocked).length
  const okRuns = auditLogs.filter((l: any) => l?.ok && !l?.blocked).length
  const majorityRuns = auditLogs.filter((l: any) => l?.verification?.majority).length
  const unanimousRuns = auditLogs.filter((l: any) => l?.verification?.unanimous).length
  const securityBlocks = auditLogs.filter((l: any) => String(l?.reason || '').toLowerCase().includes('security override')).length

  return NextResponse.json({
    ok: true,
    brand: 'Unity Credit',
    metrics: {
      total_users: totalUsers,
      monthly_saved_last_30d_sum: totalSavedMonthly,
      linked_bank_items: plaidTokens.length,
      plaid: { institutions, total_transactions: totalTransactions, total_balance: totalBalance },
      verification: { totalRuns, okRuns, blockedRuns, majorityRuns, unanimousRuns, securityBlocks, storage: (audit as any)?.storage, encrypted: Boolean((audit as any)?.encrypted) },
      flags: {
        upstash: upstashEnabled(),
        auditEncrypted: auditEncryptionEnabled(),
        liveSearch: false,
      },
    },
  })
}


