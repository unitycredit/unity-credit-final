/**
 * UnityCredit Email Queue Worker (Resend)
 *
 * Pulls jobs from Upstash Redis list `uc:queue:email` and sends via Resend REST API.
 * Run multiple worker processes for higher throughput.
 */

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '')
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || ''
const resendKey = process.env.RESEND_API_KEY || ''
const resendFrom = process.env.RESEND_FROM || ''
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const concurrency = Number(process.env.EMAIL_WORKER_CONCURRENCY || 10)
const idleMs = Number(process.env.EMAIL_WORKER_IDLE_MS || 500)

const QUEUE_KEY = 'uc:queue:email'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function upstashCmd(command) {
  const resp = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `Upstash HTTP ${resp.status}`)
  return json?.result
}

function money(n) {
  const x = Number(n) || 0
  return x.toFixed(0)
}

function htmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildEmail(job) {
  // Raw email mode (used by Admin negotiator / other internal tools).
  // This keeps the existing optimization template intact while allowing custom templates.
  if (job && (job.kind === 'raw' || job.type === 'raw')) {
    const subject = String(job.subject || '').trim() || 'Unity Credit'
    const text = String(job.text || '').trim() || ''
    const html = String(job.html || '').trim() || ''
    return { subject, text, html }
  }

  const offer = job.offer || {}
  const title = offer.title_yi || 'אפטימיזאציע־אופער'
  const monthlySavings = Number(offer.monthly_savings) || 0
  const savings = money(monthlySavings)
  const annualSavings = money(monthlySavings * 12)
  const provider = offer.provider_name ? `פראוויידער: ${offer.provider_name}` : ''
  const link = offer.provider_url ? offer.provider_url : ''

  const subject =
    offer.email_subject_yi ||
    `Unity Credit — פארמעגן־פירן אלערט: ${title} (שפּאָר ~$${savings}/חודש)`

  const bodyYI =
    offer.email_body_yi ||
    `שלום,\n\nמיר האבן געפונען א נייע אפטימיזאציע־אלערט:\n- ${title}\n- געשאצטע סאווינגס: ~$${savings}/חודש (~$${annualSavings}/יער)\n${provider ? `- ${provider}\n` : ''}${
      link ? `\nלינק: ${link}\n` : ''
    }\n\nיישר כח,\nUnity Credit`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0b0f14;padding:28px;">
    <div style="max-width:720px;margin:0 auto;background:#0f141b;border:1px solid rgba(212,175,55,0.25);border-radius:18px;overflow:hidden;">
      <div style="padding:18px 22px;background:linear-gradient(90deg,#0b0f14,#111827);border-bottom:1px solid rgba(212,175,55,0.25);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-weight:900;color:#d4af37;letter-spacing:0.5px;">Unity Credit</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);direction:rtl;text-align:right;">פארמעגן־פירן · אפטימיזאציע־אלערטס</div>
        </div>
        <div style="margin-top:6px;color:rgba(255,255,255,0.85);font-size:12px;direction:rtl;text-align:right;">
          אפטימיזאציע־צענטער — פראפעשאנעלער באריכט
        </div>
      </div>

      <div style="padding:22px;direction:rtl;text-align:right;color:#e5e7eb;">
        <div style="font-size:20px;font-weight:900;color:#f5f3e7;">${htmlEscape(title)}</div>

        <div style="margin-top:14px;border:1px solid rgba(212,175,55,0.22);border-radius:14px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(212,175,55,0.10);">
                <th style="padding:10px 12px;font-size:12px;color:#d4af37;text-align:right;">פעלד</th>
                <th style="padding:10px 12px;font-size:12px;color:#d4af37;text-align:right;">דעטאלן</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-top:1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.75);">חודש׳ליכע סאווינגס</td>
                <td style="padding:10px 12px;font-size:13px;font-weight:900;color:#f5f3e7;">$${htmlEscape(savings)} / חודש</td>
              </tr>
              <tr style="border-top:1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.75);">יער׳ליכע סאווינגס</td>
                <td style="padding:10px 12px;font-size:13px;font-weight:900;color:#d4af37;">$${htmlEscape(annualSavings)} / יער</td>
              </tr>
              <tr style="border-top:1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.75);">פראוויידער</td>
                <td style="padding:10px 12px;font-size:13px;color:#f5f3e7;">${offer.provider_name ? htmlEscape(offer.provider_name) : '—'}</td>
              </tr>
              <tr style="border-top:1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.75);">באַדינגונגען / באמערקונגען</td>
                <td style="padding:10px 12px;font-size:12px;color:rgba(255,255,255,0.85);">${offer.eligibility ? htmlEscape(offer.eligibility) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${link ? `<div style="margin-top:14px;"><a href="${htmlEscape(link)}" style="display:inline-block;padding:12px 16px;border-radius:14px;background:#d4af37;color:#0b0f14;text-decoration:none;font-weight:900;">עפענען לינק</a></div>` : ''}

        <div style="margin-top:16px;color:rgba(255,255,255,0.75);font-size:12px;white-space:pre-wrap;line-height:1.6;">${htmlEscape(bodyYI)}</div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(212,175,55,0.18);color:rgba(255,255,255,0.55);font-size:11px;direction:rtl;text-align:right;">
          © ${new Date().getFullYear()} Unity Credit. אלע רעכטן פארבאהאלטן. קאנפידענציעל.
        </div>
      </div>
    </div>
  </div>
  `.trim()

  return { subject, text: bodyYI, html }
}

async function sendResend(to, subject, html, text) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject,
      html,
      text,
    }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.message || `Resend HTTP ${resp.status}`)
  return json
}

async function upsertEmailLog(payload) {
  if (!supabaseUrl || !supabaseServiceKey) return
  try {
    // PostgREST upsert (merge duplicates) by primary key `id`.
    const resp = await fetch(`${supabaseUrl}/rest/v1/email_logs?on_conflict=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([payload]),
    })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      console.error('[email-worker] email_logs upsert failed', resp.status, t.slice(0, 200))
    }
  } catch (e) {
    console.error('[email-worker] email_logs upsert error', e?.message || e)
  }
}

async function workerLoop(workerId) {
  while (true) {
    try {
      const raw = await upstashCmd(['RPOP', QUEUE_KEY])
      if (!raw) {
        await sleep(idleMs)
        continue
      }
      const job = JSON.parse(String(raw))
      const { subject, html, text } = buildEmail(job)
      const sent = await sendResend(job.to, subject, html, text)
      await upsertEmailLog({
        id: String(job.id || ''),
        provider: 'resend',
        kind: String(job?.meta?.kind || job.kind || job.type || 'raw'),
        to_email: String(job.to || ''),
        subject: String(subject || ''),
        status: 'sent',
        resend_id: String(sent?.id || sent?.data?.id || ''),
        meta: job.meta || null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      console.log(`[email-worker#${workerId}] sent job=${job.id} to=${job.to}`)
    } catch (e) {
      console.error(`[email-worker#${workerId}] error`, e?.message || e)
      await sleep(250)
    }
  }
}

async function main() {
  if (!redisUrl || !redisToken) throw new Error('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN missing')
  if (!resendKey || !resendFrom) throw new Error('RESEND_API_KEY/RESEND_FROM missing')
  console.log(`[email-worker] starting · concurrency=${concurrency}`)
  await Promise.all(Array.from({ length: concurrency }, (_, i) => workerLoop(i + 1)))
}

main().catch((e) => {
  console.error('[email-worker] fatal', e?.message || e)
  process.exit(1)
})


