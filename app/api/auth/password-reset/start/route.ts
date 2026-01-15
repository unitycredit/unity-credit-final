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
  const rl = await enforceRateLimit(req, 'OTP_SEND')
  if (!rl.allowed) {
    return NextResponse.json({ error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }, { status: 429, headers: rl.headers })
  }

  const body = (await req.json().catch(() => ({}))) as any
  const email = sanitizeInput(String(body?.email || '')).trim()
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'אומגילטיגע אימעיל אדרעס.' }, { status: 400, headers: rl.headers })
  }

  const eh = createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_SEND_EMAIL', `reset:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  const resp = await callCognitoBoto3('forgot_password', { email: normalizeEmail(email) })
  if (!resp.ok) {
    return NextResponse.json(
      { error: String((resp as any)?.error || 'Failed to start password reset'), error_code: (resp as any)?.error_code || 'cognito_forgot_failed' },
      { status: Number((resp as any)?.status || 400), headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  return NextResponse.json(
    { ok: true, sent: true, via: 'cognito', code_delivery: (resp as any)?.code_delivery || null },
    { status: 200, headers: { ...rl.headers, ...rlEmail.headers, 'Cache-Control': 'no-store' } }
  )
}

