import 'server-only'

import { createAdminClient } from '@/lib/supabase-admin'

export type BankSyncStatus = 'never_connected' | 'active' | 'reconnect_required' | 'error'

export async function setBankSyncState(params: {
  user_id: string
  status: BankSyncStatus
  provider?: string
  last_sync_at?: string | null
  last_success_at?: string | null
  last_error_code?: string | null
  last_error_message?: string | null
}) {
  const admin = createAdminClient()
  if (!admin) return { ok: false as const, error: 'Supabase admin client not configured' }

  const now = new Date().toISOString()
  const payload = {
    user_id: params.user_id,
    provider: params.provider || 'plaid',
    status: params.status,
    last_sync_at: params.last_sync_at ?? now,
    last_success_at: params.last_success_at ?? (params.status === 'active' ? now : null),
    last_error_code: params.last_error_code ?? null,
    last_error_message: params.last_error_message ?? null,
    updated_at: now,
  }

  const { error } = await admin.from('bank_sync_state').upsert(payload as any, { onConflict: 'user_id' })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

export async function readBankSyncState(params: { user_id: string }) {
  const admin = createAdminClient()
  if (!admin) return { ok: false as const, error: 'Supabase admin client not configured', state: null as any }
  const { data, error } = await admin.from('bank_sync_state').select('*').eq('user_id', params.user_id).maybeSingle()
  if (error) return { ok: false as const, error: error.message, state: null as any }
  return { ok: true as const, state: data || null }
}


