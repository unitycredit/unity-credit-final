import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createHash, randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase'
import { maintenanceMessageYi, readEmergencyControl } from '@/lib/emergency-control'
import { sesConfig, sendSesEmail } from '@/lib/aws/ses'

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

// Back-compat export name: the app historically used Resend. We now route through AWS SES.
export function resendConfig() {
  const cfg = sesConfig()
  return { from: cfg.fromEmail, key: '', ok: cfg.ok }
}

export function hashId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}

export async function sendResendDirect(params: { to: string; subject: string; html?: string; text?: string }) {
  const ec = await readEmergencyControl().catch(() => null)
  if (ec?.switches?.email_dispatch && ec.switches.email_dispatch.enabled === false) {
    throw new Error(maintenanceMessageYi())
  }
  // SES send (uses IAM role / instance credentials in AWS; uses AWS_PROFILE locally).
  const sent = await sendSesEmail(params)
  return sent as any
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
            provider: 'ses',
            kind: String(job.meta?.kind || job.kind || 'raw'),
            to_email: job.to,
            subject: job.subject,
            status: 'sent',
            resend_id: String((sent as any)?.MessageId || ''),
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
          provider: 'ses',
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


