import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
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
  const rl = await enforceRateLimit(req, 'OTP_VERIFY')
  if (!rl.allowed) return NextResponse.json({ error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const email = sanitizeInput(String(body?.email || '')).trim()
  const code = sanitizeInput(String(body?.code || body?.token || '')).trim().replace(/\s+/g, '')
  const purpose = String(body?.purpose || 'signup').trim()

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'אומגילטיגע דאטן.' }, { status: 400, headers: rl.headers })
  }

  const normalizedEmail = normalizeEmail(email)

  const eh = emailHash(email)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_VERIFY_EMAIL', `${purpose}:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  // Confirm via Cognito confirmation code (sent by Cognito/SES).
  const resp = await callCognitoBoto3('confirm_sign_up', { email: normalizedEmail, code })
  if (!resp.ok) {
    const codeMsg = String((resp as any)?.error_code || '')
    const msg =
      codeMsg === 'CodeMismatchException'
        ? 'אומגילטיגער קאָד. ביטע קאָנטראָלירט די 6 ציפערן און פרובירט נאכאמאל.'
        : codeMsg === 'ExpiredCodeException'
        ? 'דער קאָד איז אויסגעגאנגען. ביטע דריקט "שיק נאכאמאל" און נוצט דעם נייעם קאָד.'
        : 'א טעות איז פארגעקומען. פרובירט נאכאמאל.'
    return NextResponse.json(
      { ok: false, error: msg, error_code: codeMsg || 'cognito_confirm_failed' },
      { status: Number((resp as any)?.status || 400), headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  // Mark verified in RDS (best-effort).
  try {
    await prisma.user.updateMany({ where: { email: normalizedEmail }, data: { emailVerifiedAt: new Date() } })
  } catch {
    // ignore
  }

  // Note: OTP verification does not create an authenticated NextAuth session.
  // Client will redirect user to /login and then they sign in normally.
  return NextResponse.json(
    { ok: true, verified: true, session: false, redirect_to: `/login?email=${encodeURIComponent(normalizedEmail)}&verified=1` },
    { status: 200, headers: { ...rl.headers, ...rlEmail.headers } }
  )
}


