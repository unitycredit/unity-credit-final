import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type TableCheck = { table: string; ok: boolean; error?: string }

async function checkTable(admin: any, table: string): Promise<TableCheck> {
  try {
    // HEAD-style select isn't exposed in supabase-js, but `head: true` avoids transferring rows.
    const { error } = await admin.from(table).select('id', { head: true, count: 'exact' }).limit(1)
    if (error) return { table, ok: false, error: error.message }
    return { table, ok: true }
  } catch (e: any) {
    return { table, ok: false, error: e?.message || 'unknown error' }
  }
}

export async function GET() {
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Supabase admin client is not configured (SUPABASE_SERVICE_ROLE_KEY missing).',
        tables: [],
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const tablesToCheck = [
    // Profiles/users
    'users',
    // Bank + Plaid
    'plaid_tokens',
    'plaid_accounts',
    'plaid_transactions',
    'bank_sync_state',
    // Smart savings local insights
    'user_savings_snapshots',
    'user_savings_events',
  ]

  const results: TableCheck[] = []
  for (const t of tablesToCheck) {
    results.push(await checkTable(admin, t))
  }

  const missing = results.filter((r) => !r.ok).map((r) => r.table)
  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing_tables: missing,
      tables: results,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}


