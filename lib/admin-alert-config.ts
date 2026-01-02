import { createAdminClient } from '@/lib/supabase-admin'

export type AdminAlertConfig = {
  owner_email: string | null
  owner_phone: string | null
  updated_at: string | null
}

function safe(v: any) {
  const s = String(v || '').trim()
  return s ? s : null
}

function safeIso(v: any) {
  const s = String(v || '').trim()
  const t = Date.parse(s)
  return Number.isFinite(t) ? s : null
}

export async function readAdminAlertConfig(): Promise<AdminAlertConfig> {
  const admin = createAdminClient()
  if (!admin) return { owner_email: null, owner_phone: null, updated_at: null }
  const { data } = await admin.from('admin_alert_config').select('owner_email,owner_phone,updated_at').eq('key', 'owner').maybeSingle()
  return {
    owner_email: safe((data as any)?.owner_email),
    owner_phone: safe((data as any)?.owner_phone),
    updated_at: safeIso((data as any)?.updated_at),
  }
}

export async function writeAdminAlertConfig(next: Partial<AdminAlertConfig>) {
  const admin = createAdminClient()
  if (!admin) return { ok: false as const, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }
  const payload = {
    key: 'owner',
    owner_email: safe((next as any)?.owner_email),
    owner_phone: safe((next as any)?.owner_phone),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from('admin_alert_config').upsert(payload as any, { onConflict: 'key' }).select('*').maybeSingle()
  if (error) return { ok: false as const, error: 'update failed' }
  return { ok: true as const, row: data as any }
}


