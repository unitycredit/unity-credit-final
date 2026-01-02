import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createHash, randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase'
import { maintenanceMessageYi, readEmergencyControl } from '@/lib/emergency-control'

const EMAIL_QUEUE_KEY = 'uc:queue:email'

export type RawEmailJob = {
  id: string
  kind: 'raw'
  created_at: string
  to: string
  subject: string
  text?: string
  html?: string
  meta?: Record<string, any>
}

export function resendConfig() {
  const from = String(process.env.RESEND_FROM || '').trim()
  const key = String(process.env.RESEND_API_KEY || '').trim()
  return { from, key, ok: Boolean(from && key) }
}

export function hashId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}

export async function sendResendDirect(params: { to: string; subject: string; html?: string; text?: string }) {
  const ec = await readEmergencyControl().catch(() => null)
  if (ec?.switches?.email_dispatch && ec.switches.email_dispatch.enabled === false) {
    throw new Error(maintenanceMessageYi())
  }
  const cfg = resendConfig()
  if (!cfg.ok) throw new Error('Email provider not configured (RESEND_API_KEY/RESEND_FROM).')

  const ctrl = new AbortController()
  const timeoutMs = Number(process.env.RESEND_TIMEOUT_MS || 8000)
  const id = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs))
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [params.to],
      subject: params.subject,
      html: params.html || undefined,
      text: params.text || undefined,
    }),
    signal: ctrl.signal,
  }).finally(() => clearTimeout(id))
  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.message || `Resend HTTP ${resp.status}`)
  return json
}

export async function queueRawEmail(params: {
  to: string
  subject: string
  text?: string
  html?: string
  meta?: Record<string, any>
  jobId?: string
}) {
  const ec = await readEmergencyControl().catch(() => null)
  if (ec?.switches?.email_dispatch && ec.switches.email_dispatch.enabled === false) {
    return { ok: false, queued: false, sent: false, job_id: null as any, via: 'blocked' as const, error: maintenanceMessageYi() }
  }
  const id =
    String(params.jobId || '').trim() ||
    hashId([params.to, params.subject, String(params.text || '').slice(0, 128), randomUUID()])

  const job: RawEmailJob = {
    id,
    kind: 'raw',
    created_at: new Date().toISOString(),
    to: params.to,
    subject: params.subject,
    text: params.text || '',
    html: params.html || '',
    meta: params.meta || {},
  }

  if (!upstashEnabled()) {
    // Direct send (no queue configured).
    const sent = await sendResendDirect({ to: job.to, subject: job.subject, html: job.html, text: job.text })
    // Best-effort: log delivery to Supabase for admin auditing.
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin = createServerClient()
        await admin.from('email_logs').upsert(
          {
            id: job.id,
            provider: 'resend',
            kind: String(job.meta?.kind || job.kind || 'raw'),
            to_email: job.to,
            subject: job.subject,
            status: 'sent',
            resend_id: String((sent as any)?.id || (sent as any)?.data?.id || ''),
            meta: job.meta || null,
            queued_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        )
      }
    } catch {
      // ignore
    }
    return { ok: true, queued: false, sent: true, job_id: id, via: 'direct' as const }
  }

  await upstashCmd(['LPUSH', EMAIL_QUEUE_KEY, JSON.stringify(job)]).catch(() => null)
  // Best-effort: log queueing to Supabase for admin auditing.
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createServerClient()
      await admin.from('email_logs').upsert(
        {
          id: job.id,
          provider: 'resend',
          kind: String(job.meta?.kind || job.kind || 'raw'),
          to_email: job.to,
          subject: job.subject,
          status: 'queued',
          meta: job.meta || null,
          queued_at: new Date().toISOString(),
        } as any,
        { onConflict: 'id' }
      )
    }
  } catch {
    // ignore
  }
  return { ok: true, queued: true, sent: false, job_id: id, via: 'queue' as const }
}


