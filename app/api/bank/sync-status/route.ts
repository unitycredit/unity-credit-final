import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Optional: per-user sync state (if installed)
  let sync_state: any = null
  try {
    const { data } = await supabase.from('bank_sync_state').select('status,last_sync_at,last_success_at,last_error_code,last_error_message,updated_at').eq('user_id', user.id).maybeSingle()
    sync_state = data || null
  } catch {
    sync_state = null
  }

  const { count, error } = await supabase
    .from('plaid_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const { data: latest } = await supabase
    .from('plaid_transactions')
    .select('occurred_on,created_at')
    .eq('user_id', user.id)
    .order('occurred_on', { ascending: false })
    .limit(1)

  const row = Array.isArray(latest) ? latest[0] : null
  return NextResponse.json({
    ok: true,
    sync_state,
    transactions_count: count || 0,
    latest_occurred_on: row?.occurred_on || null,
    latest_row_created_at: row?.created_at || null,
  })
}


