import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const supabaseAdmin = createAdminClient()
  let users: any[] = []

  if (supabaseAdmin) {
    const page = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get('page') || 1)))
    const perPage = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('perPage') || 200)))
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (!error) users = data?.users || []
  }

  // Plaid status (dev/sandbox): local token cache is global, not per-user.
  let plaidTokensCount = 0
  const tokens = await readStoredPlaidTokens().catch(() => [])
  plaidTokensCount = Array.isArray(tokens) ? tokens.length : 0

  return NextResponse.json({
    ok: true,
    has_service_role: Boolean(supabaseAdmin),
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
      banned_until: u.banned_until,
    })),
    plaid: {
      tokens_count: plaidTokensCount,
      note:
        'In dev/sandbox, Plaid tokens are stored locally and not tied to specific users. For per-user Plaid status, persist items in DB.',
    },
  })
}


