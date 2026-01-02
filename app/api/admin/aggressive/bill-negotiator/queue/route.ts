import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { buildBillNegotiationDraft, type BillType } from '@/lib/bill-negotiator'
import { queueRawEmail } from '@/lib/email-queue'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { maintenanceMessageYi, readEmergencyControl } from '@/lib/emergency-control'

export const runtime = 'nodejs'

const EMAIL_QUEUE_KEY = 'uc:queue:email'

function hashId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}

function htmlEscape(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildNegotiationHtml(params: { provider?: string; body: string }) {
  const provider = String(params.provider || '').trim()
  const body = String(params.body || '').trim()
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0f14;padding:28px;">
    <div style="max-width:720px;margin:0 auto;background:#0f141b;border:1px solid rgba(212,175,55,0.25);border-radius:18px;overflow:hidden;">
      <div style="padding:18px 22px;background:linear-gradient(90deg,#0b0f14,#111827);border-bottom:1px solid rgba(212,175,55,0.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-weight:900;color:#d4af37;letter-spacing:0.5px;">Unity Credit</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);direction:rtl;text-align:right;">Auto‑Negotiator · ביל</div>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,0.85);font-size:12px;direction:rtl;text-align:right;">
          פראפעשאנעלער נעגאציע־בריוו
        </div>
      </div>

      <div style="padding:22px;direction:rtl;text-align:right;color:#e5e7eb;">
        ${provider ? `<div style="font-size:14px;font-weight:900;color:#f5f3e7;">${htmlEscape(provider)}</div>` : ''}
        <div style="margin-top:12px;color:rgba(255,255,255,0.80);font-size:13px;white-space:pre-wrap;line-height:1.7;">${htmlEscape(
          body
        )}</div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,175,55,0.18);color:rgba(255,255,255,0.55);font-size:11px;direction:rtl;text-align:right;">
          © ${new Date().getFullYear()} Unity Credit. אלע רעכטן פארבאהאלטן. קאנפידענציעל.
        </div>
      </div>
    </div>
  </div>
  `.trim()
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const ec = await readEmergencyControl().catch(() => null)
  if (ec?.switches?.email_dispatch && ec.switches.email_dispatch.enabled === false) {
    return NextResponse.json({ error: maintenanceMessageYi(), maintenance: true }, { status: 503 })
  }

  const upstashOk = upstashEnabled()

  const from = String(process.env.RESEND_FROM || '').trim()
  const key = String(process.env.RESEND_API_KEY || '').trim()
  const resendOk = Boolean(from && key)
  if (!resendOk) return NextResponse.json({ error: 'אימעיל־סערוויס איז נישט קאנפיגורירט (RESEND_API_KEY/RESEND_FROM).' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as any
  const to = sanitizeInput(String(body?.to || '')).trim()
  const provider_name = sanitizeInput(String(body?.provider_name || '')).trim()
  const bill_type: BillType = String(body?.bill_type || 'utility') === 'cellular' ? 'cellular' : 'utility'

  const current_monthly = Number(body?.current_monthly)
  const desired_monthly = Number(body?.desired_monthly)
  const account_hint = sanitizeInput(String(body?.account_hint || '')).trim() || null
  const notes = sanitizeInput(String(body?.notes || '')).trim() || null

  let subject_yi = sanitizeInput(String(body?.subject_yi || '')).trim()
  let body_yi = sanitizeInput(String(body?.body_yi || '')).trim()

  if (!to || !to.includes('@')) return NextResponse.json({ error: 'Missing recipient email.' }, { status: 400 })
  if (!provider_name) return NextResponse.json({ error: 'Missing provider.' }, { status: 400 })
  if (!Number.isFinite(current_monthly) || current_monthly <= 0) return NextResponse.json({ error: 'Invalid current monthly.' }, { status: 400 })
  if (!Number.isFinite(desired_monthly) || desired_monthly < 0) return NextResponse.json({ error: 'Invalid desired monthly.' }, { status: 400 })

  if (!subject_yi || !body_yi) {
    const draft = buildBillNegotiationDraft({ provider_name, bill_type, current_monthly, desired_monthly, account_hint, notes })
    subject_yi = subject_yi || draft.subject
    body_yi = body_yi || draft.body
  }

  const html = buildNegotiationHtml({ provider: provider_name || undefined, body: body_yi })

  const job_id = hashId([to, subject_yi, String(body_yi).slice(0, 128)])
  const dedupeKey = `uc:billneg:job:${job_id}`
  if (upstashOk) {
    const dedupe = await upstashCmd<any>(['SET', dedupeKey, '1', 'NX', 'EX', 86400]).catch(() => null)
    if ((dedupe as any)?.result !== 'OK') {
      return NextResponse.json({ ok: true, queued: false, job_id, reason: 'duplicate' })
    }
  }

  const job = {
    id: job_id,
    kind: 'raw',
    created_at: new Date().toISOString(),
    to,
    subject: subject_yi,
    text: body_yi,
    html,
    meta: { type: 'bill_negotiation', bill_type, provider_name },
  }

  let queued_storage: 'redis' | 'direct' | 'file' = 'redis'
  if (upstashOk) {
    await upstashCmd(['LPUSH', EMAIL_QUEUE_KEY, JSON.stringify(job)]).catch(() => null)
  } else {
    // No queue configured → send immediately via Resend (and log to Supabase).
    const dispatched = await queueRawEmail({
      to,
      subject: subject_yi,
      text: body_yi,
      html,
      jobId: job_id,
      meta: { kind: 'negotiator', type: 'bill_negotiation', bill_type, provider_name },
    }).catch(() => null)
    queued_storage = dispatched?.via === 'direct' ? 'direct' : 'file'
    if (!dispatched) {
      // Last-resort dev fallback: write to file so nothing is lost during testing.
      queued_storage = 'file'
      try {
        const dir = path.join(process.cwd(), '.data')
        await fs.mkdir(dir, { recursive: true })
        await fs.appendFile(path.join(dir, 'email_queue.jsonl'), JSON.stringify(job) + '\n', 'utf8')
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    job_id,
    queued_storage,
    resend_configured: resendOk,
    preview: { subject: subject_yi, to, provider_name, bill_type },
  })
}


