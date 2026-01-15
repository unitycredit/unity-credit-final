import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { prisma } from '@/lib/prisma'
import { createHash } from 'node:crypto'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

export const runtime = 'nodejs'

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return email.includes('@') && email.length <= 254
}

function emailHash(email: string) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32)
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'OTP_SEND')
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: rl.headers }
    )
  }

  const body = (await req.json().catch(() => ({}))) as any
  const email = sanitizeInput(String(body?.email || '')).trim()
  const purpose = String(body?.purpose || 'signup').trim()

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'אומגילטיגע אימעיל אדרעס.' }, { status: 400, headers: rl.headers })
  }

  const eh = emailHash(email)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_SEND_EMAIL', `${purpose}:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  // Ensure a user row exists in RDS (placeholder is fine until full signup completes).
  const normalized = normalizeEmail(email)
  const user =
    (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }).catch(() => null)) ||
    null
  try {
    if (!user?.id) {
      await prisma.user.create({ data: { email: normalized } as any, select: { id: true } }).catch(() => null)
    }
  } catch {
    // ignore (do not block resend)
  }

  try {
    // Cognito will send the confirmation code via its configured email sender (Cognito/SES).
    const resp = await callCognitoBoto3('resend_confirmation_code', { email: normalized })
    if (!resp.ok) {
      const msg = String((resp as any)?.error || 'Failed to resend code')
      return NextResponse.json(
        { ok: false, error: msg, error_code: (resp as any)?.error_code || 'cognito_resend_failed' },
        { status: Number((resp as any)?.status || 502), headers: { ...rl.headers, ...rlEmail.headers } }
      )
    }
    return NextResponse.json(
      { ok: true, sent: true, via: 'cognito', code_delivery: (resp as any)?.code_delivery || null },
      { status: 200, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: 'אימעיל־סערוויס טעות. ביטע פרובירט נאכאמאל.', details: e?.message || null },
      { status: 502, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }
}


