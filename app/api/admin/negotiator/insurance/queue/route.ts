import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readAdminSettings } from '@/lib/admin-settings'
import { readCategoryCatalog } from '@/lib/category-catalog-store'
import { appendGlobal, readGlobalNotifications, writeGlobalNotifications } from '@/lib/notifications'
import { queueRawEmail } from '@/lib/email-queue'
import { maintenanceMessageYi, readEmergencyControl } from '@/lib/emergency-control'
import { dataPath, ensureDataDir } from '@/lib/server-paths'

export const runtime = 'nodejs'

const EMAIL_QUEUE_KEY = 'uc:queue:email'
const LOG_FILE = dataPath('negotiator_insurance_logs.jsonl')
const LOG_LIST_KEY = 'uc:negotiator:insurance:logs'

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
          <div style="font-size:12px;color:rgba(255,255,255,0.75);direction:rtl;text-align:right;">Auto‑Negotiator · אינשורענס</div>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,0.85);font-size:12px;direction:rtl;text-align:right;">
          פראפעשאנעלער נעגאציע־בריוו
        </div>
      </div>

      <div style="padding:22px;direction:rtl;text-align:right;color:#e5e7eb;">
        ${provider ? `<div style="font-size:14px;font-weight:900;color:#f5f3e7;">${htmlEscape(provider)}</div>` : ''}
        <div style="margin-top:12px;color:rgba(255,255,255,0.80);font-size:13px;white-space:pre-wrap;line-height:1.7;">${htmlEscape(body)}</div>

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
  const rawLine = String(body?.line || 'home')
  const line = rawLine === 'car' ? 'car' : rawLine === 'life' ? 'life' : 'home'
  const to = sanitizeInput(String(body?.to || '')).trim()
  const provider_name = sanitizeInput(String(body?.provider_name || '')).trim()
  const subject_yi = sanitizeInput(String(body?.subject_yi || '')).trim()
  let body_yi = sanitizeInput(String(body?.body_yi || '')).trim()

  if (!to || !to.includes('@')) return NextResponse.json({ error: 'Missing recipient email.' }, { status: 400 })

  if (!body_yi) {
    const settings = await readAdminSettings().catch(() => null)
    body_yi =
      line === 'car'
        ? String((settings as any)?.car_insurance_negotiation_template_yi || '').trim()
        : line === 'life'
        ? String((settings as any)?.life_insurance_negotiation_template_yi || '').trim()
        : String((settings as any)?.house_insurance_negotiation_template_yi || '').trim()
  }
  if (!body_yi) return NextResponse.json({ error: 'Missing email body.' }, { status: 400 })

  const subject =
    subject_yi ||
    (line === 'car'
      ? 'ביטע איבערקוקן מיין קאר־אינשורענס פאליסי'
      : line === 'life'
      ? 'ביטע איבערקוקן מיין לייף־אינשורענס פאליסי'
      : 'ביטע איבערקוקן מיין הויז־אינשורענס פאליסי')
  const text = body_yi
  // Optional: append a short discount checklist from the Category Catalog (if available).
  // This keeps the letter professional and grounded in public sources.
  let augmentedBody = body_yi
  try {
    const db = await readCategoryCatalog()
    const catKey = line === 'car' ? 'insurance_car' : line === 'life' ? 'insurance_life' : 'insurance_home'
    const cat = (db.categories || []).find((c: any) => String(c?.key || '') === catKey)
    const providers = Array.isArray(cat?.providers) ? cat.providers : []
    const match =
      provider_name && providers.length
        ? providers.find((p: any) => String(p?.name || '').toLowerCase().includes(String(provider_name).toLowerCase().slice(0, 12)))
        : null
    const discounts = Array.isArray(match?.hidden_discounts)
      ? match.hidden_discounts
      : providers.flatMap((p: any) => (Array.isArray(p?.hidden_discounts) ? p.hidden_discounts : [])).slice(0, 8)

    const titles = discounts
      .map((d: any) => String(d?.title || '').trim())
      .filter(Boolean)
      .slice(0, 6)

    if (titles.length) {
      augmentedBody = `${augmentedBody}\n\nביטע איבערקוקט אויך די מעגליכע דיסקאונטן/אפציעס:\n${titles.map((t: string) => `- ${t}`).join('\n')}`
    }
  } catch {
    // ignore
  }

  const html = buildNegotiationHtml({ provider: provider_name || undefined, body: augmentedBody })

  const job_id = hashId([to, subject, String(body_yi).slice(0, 128)])
  const dedupeKey = `uc:negotiator:insurance:${line}:job:${job_id}`
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
    subject,
    text: augmentedBody,
    html,
    meta: { provider_name: provider_name || null, type: 'insurance_negotiation', line },
  }

  // Queueing:
  // - Preferred: Upstash queue
  // - Without Upstash: send immediately via Resend (and log to Supabase)
  let queued_storage: 'redis' | 'direct' | 'file' = 'redis'
  if (upstashOk) {
    await upstashCmd(['LPUSH', EMAIL_QUEUE_KEY, JSON.stringify(job)]).catch(() => null)
  } else {
    const dispatched = await queueRawEmail({
      to,
      subject,
      text: augmentedBody,
      html,
      jobId: job_id,
      meta: { kind: 'negotiator', type: 'insurance_negotiation', line, provider_name: provider_name || null },
    }).catch(() => null)
    queued_storage = dispatched?.via === 'direct' ? 'direct' : 'file'
    if (!dispatched) {
      queued_storage = 'file'
      try {
        await ensureDataDir()
        await fs.appendFile(dataPath('email_queue.jsonl'), JSON.stringify(job) + '\n', 'utf8')
      } catch {
        // ignore
      }
    }
  }

  const log = { logged_at: new Date().toISOString(), job_id, to, provider_name: provider_name || null, line, queued_storage, resend_configured: resendOk }
  if (upstashOk) {
    await upstashCmd(['LPUSH', LOG_LIST_KEY, JSON.stringify(log)]).catch(() => null)
    await upstashCmd(['LTRIM', LOG_LIST_KEY, 0, 199]).catch(() => null)
  }

  try {
    await ensureDataDir()
    await fs.appendFile(LOG_FILE, JSON.stringify(log) + '\n', 'utf8')
  } catch {
    // ignore
  }

  // Emit notification for "ready to send" (best-effort)
  try {
    const db = await readGlobalNotifications()
    const next = appendGlobal(db, {
      id: `notif-neg-${job_id}`,
      kind: 'negotiator_ready',
      title: `Auto‑Negotiator · Ready to Send (${provider_name || line})`,
      body: `Draft queued for ${to}.`,
      created_at: new Date().toISOString(),
      meta: { job_id, to, provider_name: provider_name || null, line, queued_storage, resend_configured: resendOk },
    })
    await writeGlobalNotifications(next)
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    job_id,
    queued_storage,
    resend_configured: resendOk,
    preview: { subject, to, provider_name: provider_name || null, line },
  })
}


