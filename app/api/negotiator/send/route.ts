import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { queueRawEmail } from '@/lib/email-queue'

export const runtime = 'nodejs'

function isValidEmail(email: string) {
  const e = String(email || '').trim()
  return e.includes('@') && e.length <= 254
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'NEGOTIATOR_SEND')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }, { status: 429, headers: rl.headers })
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const userId = data?.user?.id || null
  if (!userId) {
    return NextResponse.json({ error: 'ביטע לאָגט איין כדי צו שיקן א נעגאציע־אימעיל.' }, { status: 401, headers: rl.headers })
  }

  const body = (await req.json().catch(() => ({}))) as any
  const to = sanitizeInput(String(body?.to || '')).trim()
  const subject_yi = sanitizeInput(String(body?.subject_yi || '')).trim()
  const body_yi = sanitizeInput(String(body?.body_yi || '')).trim()
  const provider_name = sanitizeInput(String(body?.provider_name || '')).trim() || null

  if (!isValidEmail(to)) {
    return NextResponse.json({ error: 'אומגילטיגע אימעיל אדרעס (צו).' }, { status: 400, headers: rl.headers })
  }
  if (!subject_yi || subject_yi.length < 3) {
    return NextResponse.json({ error: 'אימעיל־סוביעקט פעלט.' }, { status: 400, headers: rl.headers })
  }
  if (!body_yi || body_yi.length < 20) {
    return NextResponse.json({ error: 'אימעיל־טעקסט פעלט.' }, { status: 400, headers: rl.headers })
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;white-space:pre-wrap;line-height:1.7;">
      ${body_yi.replace(/\n/g, '<br/>')}
    </div>
  `.trim()

  const out = await queueRawEmail({
    to,
    subject: subject_yi,
    text: body_yi,
    html,
    meta: { kind: 'negotiator', provider_name, user_id: userId },
  })

  if ((out as any)?.ok === false) {
    return NextResponse.json({ error: String((out as any)?.error || 'Maintenance'), maintenance: true }, { status: 503, headers: rl.headers })
  }

  return NextResponse.json({ ok: true, queued: out.queued, sent: out.sent }, { status: 200, headers: rl.headers })
}


