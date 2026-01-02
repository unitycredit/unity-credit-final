import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readVerificationAudit } from '@/lib/audit-trail'
import { readSafetyKillSwitch, resumeSafetyKillSwitch } from '@/lib/safety-kill-switch'
import { createAdminClient } from '@/lib/supabase-admin'
import { resendConfig } from '@/lib/email-queue'

export const runtime = 'nodejs'

function safeIso(v: any) {
  const s = String(v || '').trim()
  const t = Date.parse(s)
  return Number.isFinite(t) ? s : null
}

function pickLatestLog(logs: any[]) {
  let best: any | null = null
  let bestTs = -1
  for (const e of logs || []) {
    const ts = safeIso((e as any)?.logged_at || (e as any)?.ts || (e as any)?.at || '')
    const t = ts ? Date.parse(ts) : NaN
    if (!Number.isFinite(t)) continue
    if (t > bestTs) {
      bestTs = t
      best = e
    }
  }
  // Fallback: if nothing had a parseable timestamp, return the first entry
  return best || (Array.isArray(logs) && logs.length ? logs[0] : null)
}

async function supabaseAuthHealth() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  const baseInfo = {
    configured: Boolean(supabaseUrl && anonKey),
    supabase_host: (() => {
      try {
        return supabaseUrl ? new URL(supabaseUrl).host : null
      } catch {
        return null
      }
    })(),
  }

  if (!supabaseUrl || !anonKey) return { ok: false, ...baseInfo, status: 0, statusText: 'Missing env vars' }

  try {
    const url = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`
    const res = await fetch(url, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: 'no-store',
    })
    const text = await res.text().catch(() => '')
    return {
      ok: res.ok,
      ...baseInfo,
      status: res.status,
      statusText: res.statusText,
      response: text.slice(0, 300),
    }
  } catch (e: any) {
    return { ok: false, ...baseInfo, status: 0, statusText: e?.message || 'Network error' }
  }
}

async function emailDeliveryRates() {
  const cfg = resendConfig()
  const admin = createAdminClient()
  if (!admin) {
    return {
      ok: false,
      resend_configured: cfg.ok,
      reason: 'SUPABASE_SERVICE_ROLE_KEY missing (email_logs unavailable)',
    }
  }

  const now = Date.now()
  const windowHours = 24
  const sinceIso = new Date(now - windowHours * 60 * 60 * 1000).toISOString()

  const [sent, failed, queued] = await Promise.all([
    admin.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', sinceIso),
    admin.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', sinceIso),
    admin.from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'queued').gte('created_at', sinceIso),
  ])

  const sentCount = Number((sent as any)?.count || 0)
  const failedCount = Number((failed as any)?.count || 0)
  const queuedCount = Number((queued as any)?.count || 0)
  const denom = sentCount + failedCount
  const successRate = denom > 0 ? sentCount / denom : null

  return {
    ok: true,
    resend_configured: cfg.ok,
    window_hours: windowHours,
    counts: { sent: sentCount, failed: failedCount, queued: queuedCount },
    success_rate: successRate,
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const [audit, sw, supabase, email] = await Promise.all([
    readVerificationAudit(600).catch(() => ({ ok: true, storage: 'none', encrypted: false, logs: [] as any[] })),
    readSafetyKillSwitch().catch(() => null),
    supabaseAuthHealth(),
    emailDeliveryRates(),
  ])

  const logs = Array.isArray((audit as any)?.logs) ? (audit as any).logs : []
  const latest = pickLatestLog(logs)

  const payload = {
    ok: true,
    now: new Date().toISOString(),
    entity: {
      name: 'Unity Credit',
      description: 'Admin-safe system health (no intelligence engine internals exposed).',
    },
    audit: { storage: (audit as any)?.storage || 'unknown', encrypted: Boolean((audit as any)?.encrypted), logs_count: logs.length },
    last_verification: latest
      ? {
          request_id: String((latest as any)?.request_id || ''),
          logged_at: safeIso((latest as any)?.logged_at || null),
          blocked: Boolean((latest as any)?.blocked),
          reason: (latest as any)?.reason ? String((latest as any).reason).slice(0, 200) : null,
        }
      : null,
    kill_switch: sw
      ? {
          paused: Boolean(sw.state?.paused),
          paused_at: sw.state?.paused_at || null,
          updated_at: sw.state?.updated_at || null,
          reason: sw.state?.reason || null,
          storage: sw.storage,
        }
      : { paused: false, paused_at: null, updated_at: null, reason: null, storage: null },
    supabase,
    resend: { ...email },
  }

  const res = NextResponse.json(payload)
  res.headers.set('Cache-Control', 'no-store, private')
  return res
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const action = String(body?.action || '').trim().toLowerCase()

  if (action === 'resume') {
    const next = await resumeSafetyKillSwitch({ by: 'admin', at: new Date().toISOString() }).catch(() => null)
    const res = NextResponse.json({ ok: true, kill_switch: next })
    res.headers.set('Cache-Control', 'no-store, private')
    return res
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}


