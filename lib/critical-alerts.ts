import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { readAdminAlertConfig } from '@/lib/admin-alert-config'

type CriticalAlertParams = {
  kind: 'consensus_offline' | 'logic_500' | 'brain_unreachable' | 'brain_error'
  subject_yi: string
  body_yi: string
  dedupe_seconds?: number
  meta?: Record<string, any>
}

function nowIso() {
  return new Date().toISOString()
}

function dedupeKey(kind: string) {
  return `uc:alert:critical:${String(kind || 'unknown').slice(0, 40)}`
}

function canSendSms() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
}

async function sendSmsTwilio(to: string, body: string) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim()
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim()
  const from = String(process.env.TWILIO_FROM_NUMBER || '').trim()
  if (!sid || !token || !from) throw new Error('SMS provider not configured')

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const params = new URLSearchParams()
  params.set('To', to)
  params.set('From', from)
  params.set('Body', body)

  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const text = await resp.text().catch(() => '')
  if (!resp.ok) throw new Error(`Twilio HTTP ${resp.status}: ${text.slice(0, 160)}`)
  return true
}

async function sendEmailResendDirect(to: string, subject: string, text: string) {
  const from = String(process.env.RESEND_FROM || '').trim()
  const key = String(process.env.RESEND_API_KEY || '').trim()
  if (!from || !key) throw new Error('Email provider not configured')

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  })
  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.message || `Resend HTTP ${resp.status}`)
  return true
}

export async function sendCriticalAlert(params: CriticalAlertParams) {
  const cfg = await readAdminAlertConfig().catch(() => ({ owner_email: null, owner_phone: null, updated_at: null }))
  const ownerEmail = String(cfg?.owner_email || '').trim()
  const ownerPhone = String(cfg?.owner_phone || '').trim()

  // No configured recipients → do nothing, but don't crash request path.
  if (!ownerEmail && !ownerPhone) return { ok: false as const, skipped: true as const, reason: 'no recipients configured' }

  // Dedupe (best-effort) to prevent alert storms at scale.
  const ttl = Math.max(30, Math.min(3600, Number(params.dedupe_seconds ?? 300)))
  if (upstashEnabled()) {
    try {
      const k = dedupeKey(params.kind)
      const set = await upstashCmd<any>(['SET', k, nowIso(), 'NX', 'EX', ttl]).catch(() => null)
      // If NX failed, Upstash returns null-ish result; treat as deduped.
      const ok = Boolean((set as any)?.result === 'OK')
      if (!ok) return { ok: false as const, skipped: true as const, reason: 'deduped' }
    } catch {
      // ignore dedupe failures
    }
  }

  const subject = String(params.subject_yi || '').trim() || 'קריטישע מעלדונג: סיסטעם אפגעשטעלט'
  const body = String(params.body_yi || '').trim()

  const results: any = { email: null as any, sms: null as any }

  if (ownerEmail) {
    try {
      await sendEmailResendDirect(ownerEmail, subject, body)
      results.email = { ok: true }
    } catch (e: any) {
      results.email = { ok: false, error: e?.message || 'email failed' }
    }
  }

  if (ownerPhone && canSendSms()) {
    try {
      // SMS body: keep tight but still Yiddish-first.
      const smsBody = `${subject}\n${body}`.slice(0, 1500)
      await sendSmsTwilio(ownerPhone, smsBody)
      results.sms = { ok: true }
    } catch (e: any) {
      results.sms = { ok: false, error: e?.message || 'sms failed' }
    }
  } else if (ownerPhone) {
    results.sms = { ok: false, error: 'SMS not configured (TWILIO_*)' }
  }

  return { ok: true as const, results, recipients: { email: ownerEmail || null, phone: ownerPhone || null } }
}


