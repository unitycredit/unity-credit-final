import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createHash } from 'node:crypto'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

export const runtime = 'nodejs'

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return email.includes('@') && email.length <= 254
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'OTP_VERIFY')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }, { status: 429, headers: rl.headers })
  }

  const body = (await req.json().catch(() => ({}))) as any
  const email = sanitizeInput(String(body?.email || '')).trim()
  const code = sanitizeInput(String(body?.code || '')).trim().replace(/\s+/g, '')
  const password = String(body?.password || '').trim()

  if (!isValidEmail(email) || !/^\d{6}$/.test(code) || password.length < 8) {
    return NextResponse.json({ error: 'אומגילטיגע דאטן.' }, { status: 400, headers: rl.headers })
  }

  const eh = createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_VERIFY_EMAIL', `reset:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  const resp = await callCognitoBoto3('confirm_forgot_password', { email: normalizeEmail(email), code, new_password: password })
  if (!resp.ok) {
    const codeMsg = String((resp as any)?.error_code || '')
    const msg =
      codeMsg === 'CodeMismatchException'
        ? 'אומגילטיגער קאָד. ביטע קאָנטראָלירט די 6 ציפערן און פרובירט נאכאמאל.'
        : codeMsg === 'ExpiredCodeException'
        ? 'דער קאָד איז אויסגעגאנגען. ביטע דריקט "שיק נאכאמאל" און נוצט דעם נייעם קאָד.'
        : String((resp as any)?.error || 'Reset failed')
    return NextResponse.json(
      { ok: false, error: msg, error_code: codeMsg || 'cognito_reset_failed' },
      { status: Number((resp as any)?.status || 400), headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  return NextResponse.json(
    { ok: true, reset: true },
    { status: 200, headers: { ...rl.headers, ...rlEmail.headers, 'Cache-Control': 'no-store' } }
  )
}

