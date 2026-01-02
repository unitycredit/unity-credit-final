import { createAdminClient } from '@/lib/supabase-admin'

export type EmergencyKey = 'global_site_access' | 'advice_engine' | 'email_dispatch'

export type EmergencySwitch = {
  key: EmergencyKey
  enabled: boolean
  resume_at: string | null
  reason: string | null
  updated_at: string | null
}

const DEFAULTS: Record<EmergencyKey, EmergencySwitch> = {
  global_site_access: { key: 'global_site_access', enabled: true, resume_at: null, reason: null, updated_at: null },
  advice_engine: { key: 'advice_engine', enabled: true, resume_at: null, reason: null, updated_at: null },
  email_dispatch: { key: 'email_dispatch', enabled: true, resume_at: null, reason: null, updated_at: null },
}

function admin() {
  return createAdminClient()
}

function safeIso(v: any) {
  const s = String(v || '').trim()
  const t = Date.parse(s)
  return Number.isFinite(t) ? s : null
}

export function maintenanceMessageYi() {
  return 'מיר האבן יעצט א קליינע טעכנישע פראבלעם, עס וועט צוריק ארבעטן אין די קומענדיגע פאר שעה'
}

export async function readEmergencyControl(): Promise<{ ok: true; switches: Record<EmergencyKey, EmergencySwitch> } | { ok: false; switches: Record<EmergencyKey, EmergencySwitch> }> {
  const a = admin()
  if (!a) return { ok: false, switches: { ...DEFAULTS } }

  // Auto-resume any expired timers (idempotent best-effort).
  const nowIso = new Date().toISOString()
  try {
    await a.from('emergency_control').update({ enabled: true, resume_at: null, reason: null } as any).eq('enabled', false).lte('resume_at', nowIso)
  } catch {
    // ignore
  }

  const { data } = await a.from('emergency_control').select('key,enabled,resume_at,reason,updated_at')
  const rows = Array.isArray(data) ? data : []
  const out: Record<EmergencyKey, EmergencySwitch> = { ...DEFAULTS }
  for (const r of rows as any[]) {
    const k = String(r?.key || '').trim() as EmergencyKey
    if (!(k === 'global_site_access' || k === 'advice_engine' || k === 'email_dispatch')) continue
    out[k] = {
      key: k,
      enabled: Boolean(r?.enabled),
      resume_at: safeIso(r?.resume_at),
      reason: r?.reason ? String(r.reason).slice(0, 200) : null,
      updated_at: safeIso(r?.updated_at),
    }
  }
  return { ok: true, switches: out }
}

export async function setEmergencySwitch(params: { key: EmergencyKey; enabled: boolean; timer_hours?: 1 | 2 | 4 | null; reason?: string | null }) {
  const a = admin()
  if (!a) return { ok: false as const, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }

  const key = params.key
  const enabled = Boolean(params.enabled)
  const hours = params.timer_hours ?? null
  const resume_at = !enabled && hours ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null
  const reason = params.reason ? String(params.reason).trim().slice(0, 200) : null

  const { data, error } = await a
    .from('emergency_control')
    .upsert({ key, enabled, resume_at, reason, updated_at: new Date().toISOString() } as any, { onConflict: 'key' })
    .select('key,enabled,resume_at,reason,updated_at')
    .maybeSingle()

  if (error) return { ok: false as const, error: 'update failed' }
  return { ok: true as const, row: data as any }
}


