import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { otpEmail } from '@/lib/email-templates'
import { resendConfig, sendResendDirect } from '@/lib/email-queue'
import { prisma } from '@/lib/prisma'
import { createHash, randomInt } from 'node:crypto'

export const runtime = 'nodejs'

const OTP_TTL_SECONDS = 10 * 60
const OTP_QUEUE_DEDUPE_SECONDS = 60

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function isValidEmail(email: string) {
  return email.includes('@') && email.length <= 254
}

function emailHash(email: string) {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 32)
}

function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function hashOtp(code: string, salt: string) {
  return createHash('sha256').update(`${salt}|${code}`).digest('hex')
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

  const now = Date.now()
  const resend = resendConfig()

  // Throttle: do not issue more than 1 OTP per minute per email+purpose.
  try {
    const recent = await prisma.emailOtp.findFirst({
      where: { emailHash: eh, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    const lastCreatedAt = recent?.createdAt ? recent.createdAt.getTime() : 0
    if (lastCreatedAt && now - lastCreatedAt < OTP_QUEUE_DEDUPE_SECONDS * 1000) {
      return NextResponse.json({ ok: true, queued: false, reason: 'throttled' }, { status: 200, headers: rl.headers })
    }
  } catch {
    // ignore throttling errors (fail open)
  }

  // Ensure a user row exists (placeholder is fine until full signup completes).
  const normalized = normalizeEmail(email)
  const user =
    (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } }).catch(() => null)) ||
    null
  const userId =
    user?.id ||
    (await prisma.user
      .create({
        data: {
          email: normalized,
        },
        select: { id: true },
      })
      .then((u) => u.id)
      .catch(() => null))

  if (!userId) {
    // Keep response generic (do not leak existence/state).
    return NextResponse.json({ ok: true, queued: false }, { status: 200, headers: rl.headers })
  }

  const code = makeCode()
  const salt = String(randomInt(100_000, 9_999_999))
  const codeHash = hashOtp(code, salt)
  const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000)

  // Store OTP (consume any previous active OTPs for this email+purpose).
  try {
    await prisma.$transaction([
      prisma.emailOtp.updateMany({
        where: { emailHash: eh, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      prisma.emailOtp.create({
        data: {
          userId,
          email: normalized,
          emailHash: eh,
          purpose,
          salt,
          codeHash,
          expiresAt,
        },
      }),
    ])
  } catch {
    return NextResponse.json({ error: 'א טעות איז פארגעקומען. פרובירט נאכאמאל.' }, { status: 500, headers: rl.headers })
  }

  const emailContent = otpEmail({ code, minutesValid: Math.round(OTP_TTL_SECONDS / 60) })

  // If email provider isn't configured, still allow dev flows to proceed by returning a debug code.
  if (!resend.ok) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          ok: true,
          queued: false,
          sent: false,
          debug_code: code,
          warning: 'RESEND not configured; returning debug_code in dev.',
        },
        { status: 200, headers: rl.headers }
      )
    }
    return NextResponse.json(
      { error: 'אימעיל־סערוויס איז נישט קאנפיגורירט (RESEND_API_KEY/RESEND_FROM).' },
      { status: 500, headers: rl.headers }
    )
  }

  try {
    await sendResendDirect({
      to: normalized,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    })
    return NextResponse.json(
      {
        ok: true,
        queued: false,
        sent: true,
        expires_at: expiresAt.toISOString(),
        ttl_seconds: OTP_TTL_SECONDS,
        via: 'direct',
      },
      { status: 200, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: 'אימעיל־סערוויס טעות. ביטע פרובירט נאכאמאל.', details: e?.message || null },
      { status: 502, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }
}


