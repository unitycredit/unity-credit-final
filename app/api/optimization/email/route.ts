import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase'
import { getAccountGovernanceStatus } from '@/lib/account-governance'
import { createServerClient } from '@/lib/supabase'
import { queueRawEmail, hashId as hashJobId } from '@/lib/email-queue'

const QUEUE_KEY = 'uc:queue:email'

function hashId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24)
}

function extractJsonObject(text: string): any | null {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  const gov = await getAccountGovernanceStatus(req)
  if (gov.user_id && gov.blocked) {
    return NextResponse.json({ error: 'Account blocked' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as any
  const offer = body?.offer || {}

  const title_yi = sanitizeInput(String(offer?.title_yi || '')).trim()
  const monthly_savings = Number(offer?.monthly_savings) || 0
  const provider_name = sanitizeInput(String(offer?.provider_name || '')).trim() || null
  const provider_url = sanitizeInput(String(offer?.provider_url || '')).trim() || null
  const email_subject_yi = sanitizeInput(String(offer?.email_subject_yi || '')).trim() || null
  const email_body_yi = sanitizeInput(String(offer?.email_body_yi || '')).trim() || null

  if (!title_yi || monthly_savings <= 0) {
    return NextResponse.json({ error: 'Invalid offer payload.' }, { status: 400 })
  }

  // Determine recipient:
  // - Production: must be authenticated user
  // - Dev/sandbox: allow overriding with `to`
  const envName = String(process.env.PLAID_ENV || 'sandbox').toLowerCase()
  let toEmail: string | null = null

  if (envName === 'production') {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    toEmail = data?.user?.email || null
    if (!toEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } else {
    const candidate = sanitizeInput(String(body?.to || '')).trim()
    toEmail = candidate || null
    if (!toEmail) {
      // Try session when available even in dev
      try {
        const supabase = await createClient()
        const { data } = await supabase.auth.getUser()
        toEmail = data?.user?.email || null
      } catch {
        // ignore
      }
    }
    if (!toEmail) return NextResponse.json({ error: 'Missing recipient email (dev requires `to`).' }, { status: 400 })
  }

  const from = String(process.env.RESEND_FROM || '').trim()
  const key = String(process.env.RESEND_API_KEY || '').trim()
  if (!from || !key) {
    // Misconfiguration / maintenance, not an internal crash.
    return NextResponse.json({ error: 'Email provider not configured (RESEND_API_KEY/RESEND_FROM).' }, { status: 503 })
  }

  const jobId = hashJobId([toEmail, title_yi, String(monthly_savings), provider_url || ''])
  // Fast duplicate check (avoid spending consensus tokens on already-sent alerts).
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createServerClient()
      const { data } = await admin.from('email_logs').select('id').eq('id', jobId).maybeSingle()
      if (data?.id) return NextResponse.json({ ok: true, queued: false, job_id: jobId, reason: 'duplicate' })
    }
  } catch {
    // ignore
  }

  // Zero-Error Architecture:
  // - Do not queue any outbound alert unless 5/5 consensus + proofreader approval succeeds.
  // - If a proofreader flags *any* issue, `/api/logic/process` will restart generation internally.
  const draftSubjectYI =
    email_subject_yi || `Unity Credit — פארמעגן־פירן אלערט: ${title_yi} (שפּאָר ~$${monthly_savings.toFixed(0)}/חודש)`
  const draftBodyYI =
    email_body_yi ||
    `שלום,\n\nמיר האבן געפונען א נייע אפטימיזאציע־אלערט:\n- ${title_yi}\n- געשאצטע סאווינגס: ~$${monthly_savings.toFixed(0)}/חודש\n${
      provider_name ? `- פראוויידער: ${provider_name}\n` : ''
    }${provider_url ? `\nלינק: ${provider_url}\n` : ''}\n\nיישר כח,\nUnity Credit`

  const consensusUrl = new URL('/api/logic/process', req.url)
  const consensusResp = await fetch(consensusUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id: `opt_email:${jobId}`,
      workflow: 'proofread_outbound',
      question:
        'Finalize the following customer email alert. Keep it fully factual. Upgrade tone to elite, high-end business English + Yiddish. Output STRICT JSON only.',
      context: {
        workflow: 'proofread_outbound',
        correspondence: {
          kind: 'customer_alert',
          to: toEmail,
          draft_subject_yi: draftSubjectYI,
          draft_body_yi: draftBodyYI,
          offer: {
            title_yi,
            monthly_savings,
            provider_name,
            provider_url,
          },
        },
      },
    }),
    cache: 'no-store',
  })
  const consensusJson = await consensusResp.json().catch(() => ({}))
  if (!consensusResp.ok || !consensusJson?.verified || !consensusJson?.verification?.unanimous) {
    return NextResponse.json(
      { error: 'Blocked: verification failed. Email was NOT queued.', blocked: true, details: consensusJson },
      { status: 409 }
    )
  }
  const finalText = String(consensusJson?.final || '').trim()
  const parsed = extractJsonObject(finalText) || {}
  const subjectEn = String(parsed?.subject_en || '').trim()
  const bodyEn = String(parsed?.body_en || '').trim()
  const subjectYiFinal = String(parsed?.subject_yi || draftSubjectYI).trim()
  const bodyYiFinal = String(parsed?.body_yi || draftBodyYI).trim()
  // Ensure professional Yiddish is always present and prioritized in the subject line.
  const combinedSubject = subjectEn ? `${subjectYiFinal} / ${subjectEn}` : subjectYiFinal
  const combinedBody = [bodyEn, bodyYiFinal].filter(Boolean).join('\n\n---\n\n')

  // Send immediately (or enqueue if Upstash is configured) using raw email mode.
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;white-space:pre-wrap;line-height:1.7;">
      ${sanitizeInput(combinedBody).replace(/\n/g, '<br/>')}
    </div>
  `.trim()

  const dispatched = await queueRawEmail({
    to: toEmail,
    subject: combinedSubject,
    text: combinedBody,
    html,
    jobId,
    meta: { kind: 'optimization', type: 'customer_alert', title_yi, monthly_savings, provider_name, provider_url },
  })

  if ((dispatched as any)?.ok === false) {
    return NextResponse.json({ error: String((dispatched as any)?.error || 'Maintenance'), maintenance: true }, { status: 503 })
  }

  return NextResponse.json({ ok: true, queued: dispatched.queued, job_id: jobId })
}


