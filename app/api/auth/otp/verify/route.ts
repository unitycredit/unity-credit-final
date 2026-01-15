import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { queueRawEmail } from '@/lib/email-queue'
import { welcomeEmail } from '@/lib/email-templates'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { resendConfig } from '@/lib/email-queue'

export const runtime = 'nodejs'

const OTP_TTL_SECONDS = 10 * 60
const MAX_VERIFY_ATTEMPTS = 8

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

  if (!isValidEmail(email) || code.length < 4) {
    return NextResponse.json({ error: 'אומגילטיגע דאטן.' }, { status: 400, headers: rl.headers })
  }

  // DEV BACKDOOR (testing only): if email service isn't active yet, allow a fixed test login.
  // Credentials: test@unity.com + 123456
  // This sets the existing dev bypass cookie so the user can enter /dashboard immediately.
  const emailProviderReady = resendConfig().ok
  const isDev = process.env.NODE_ENV !== 'production'
  const normalizedEmail = normalizeEmail(email)
  const backdoorUsed = String(req.cookies.get('uc_backdoor_used')?.value || '').trim() === '1'
  if (isDev && !backdoorUsed && !emailProviderReady && normalizedEmail === 'test@unity.com' && code === '123456') {
    const res = NextResponse.json(
      { ok: true, verified: true, session: true, redirect_to: '/dashboard', warning: 'DEV BACKDOOR: test@unity.com accepted.' },
      { status: 200, headers: rl.headers }
    )
    res.cookies.set('uc_dev_bypass', '1', { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 })
    res.cookies.set('uc_backdoor_used', '1', { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    return res
  }

  const eh = emailHash(email)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_VERIFY_EMAIL', `${purpose}:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  // Verify against Postgres-backed OTP table (Prisma model `EmailOtp`).
  const otp = await prisma.emailOtp.findFirst({
    where: { emailHash: eh, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userId: true, salt: true, codeHash: true, attempts: true, expiresAt: true, consumedAt: true, createdAt: true },
  })

  const now = Date.now()
  const expired = !otp?.id || (otp.expiresAt ? otp.expiresAt.getTime() <= now : true) || Boolean(otp?.consumedAt)
  const locked = Boolean(otp?.attempts != null && otp.attempts >= MAX_VERIFY_ATTEMPTS)

  if (expired || locked) {
    const msg = locked
      ? 'צו פיל פרובירן. ביטע ווארט א ביסל און פרובירט ווידער (אדער שיקט א נייעם קאָד).'
      : 'דער קאָד איז אויסגעגאנגען. ביטע דריקט "שיק נאכאמאל" און נוצט דעם נייעם קאָד.'
    return NextResponse.json(
      { ok: false, error: msg, error_code: locked ? 'locked' : 'expired' },
      { status: 400, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  const computed = createHash('sha256').update(`${String(otp.salt || '')}|${code}`).digest('hex')
  if (computed !== String(otp.codeHash || '')) {
    // Increment attempts on the latest OTP row.
    try {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    } catch {
      // ignore
    }
    const msg = 'אומגילטיגער קאָד. ביטע קאָנטראָלירט די 6 ציפערן און פרובירט נאכאמאל.'
    return NextResponse.json(
      { ok: false, error: msg, error_code: 'incorrect' },
      { status: 400, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  const userId = sanitizeInput(String(otp.userId || '')).trim()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'א טעות איז פארגעקומען.' }, { status: 500, headers: { ...rl.headers, ...rlEmail.headers } })
  }

  // Consume OTP + mark email verified.
  try {
    await prisma.$transaction([
      prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
      prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
    ])
  } catch {
    return NextResponse.json({ ok: false, error: 'א טעות איז פארגעקומען.' }, { status: 500, headers: { ...rl.headers, ...rlEmail.headers } })
  }

  // Send welcome email (best-effort).
  try {
    const w = welcomeEmail()
    await queueRawEmail({
      to: normalizeEmail(email),
      subject: w.subject,
      text: w.text,
      html: w.html,
      meta: { kind: 'welcome' },
    })
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


