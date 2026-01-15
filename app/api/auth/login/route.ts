import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { loginFlexibleSchema } from '@/lib/validations'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

export const runtime = 'nodejs'

const toYiddishError = (msg: string) => {
  if (msg.includes('EMAIL_NOT_VERIFIED')) return 'אייער אימעיל איז נאך נישט באַשטעטיגט. ביטע וועריפיצירט.'
  if (msg.includes('Too many requests')) return 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.'
  return 'אומגילטיגע דעטאלן. פרובירט נאכאמאל.'
}

export async function POST(request: NextRequest) {
  try {
    // Brute force protection: rate-limit login attempts (IP + identifier).
    const rlIp = await enforceRateLimit(request, 'LOGIN_ATTEMPTS')
    if (!rlIp.allowed) {
      return NextResponse.json({ error: toYiddishError('Too many requests') }, { status: 429, headers: rlIp.headers })
    }

    const body = await request.json().catch(() => ({} as any))
    const validation = loginFlexibleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן', details: validation.error.errors }, { status: 400 })
    }

    const identifierRaw = String(validation.data.email || '').trim()
    const identifier = identifierRaw.toLowerCase()
    const password = String(validation.data.password || '')

    const ih = createHash('sha256').update(identifier).digest('hex').slice(0, 32)
    const rlId = await enforceRateLimitKeyed(request, 'LOGIN_ATTEMPTS_EMAIL', ih)
    if (!rlId.allowed) {
      return NextResponse.json(
        { error: toYiddishError('Too many requests') },
        { status: 429, headers: { ...rlIp.headers, ...rlId.headers } }
      )
    }

    const isEmail = identifier.includes('@')

  // 1) Primary: Cognito User Pool users by email.
  // This endpoint is "back-compat" (does not establish a NextAuth browser session), but it should
  // still validate credentials against Cognito to match the Unity Credit login flow.
    if (isEmail) {
    const cog = await callCognitoBoto3<{ claims?: any }>('initiate_auth', { email: identifier, password })
    if (!cog.ok) {
      const code = String((cog as any)?.error_code || '')
      if (code === 'UserNotConfirmedException') {
        return NextResponse.json(
          { error: toYiddishError('EMAIL_NOT_VERIFIED'), error_code: 'EMAIL_NOT_VERIFIED' },
          { status: 403, headers: { ...rlIp.headers, ...rlId.headers } }
        )
      }
      // Do not leak internal Cognito errors as "wrong password".
      return NextResponse.json(
        { error: toYiddishError('Invalid'), error_code: code || 'COGNITO_AUTH_FAILED' },
        { status: 401, headers: { ...rlIp.headers, ...rlId.headers } }
      )
    }

    const claims = (cog as any)?.claims || {}
    const emailVerified = Boolean(claims?.email_verified)
    if (process.env.NODE_ENV === 'production' && !emailVerified) {
      return NextResponse.json(
        { error: toYiddishError('EMAIL_NOT_VERIFIED'), error_code: 'EMAIL_NOT_VERIFIED' },
        { status: 403, headers: { ...rlIp.headers, ...rlId.headers } }
      )
    }

    const firstName = String(claims?.given_name || '').trim() || null
    const lastName = String(claims?.family_name || '').trim() || null
    const phone = String(claims?.phone_number || '').trim() || null

    // Ensure the internal user row exists in RDS for app data ownership.
    let user =
      (await prisma.user
        .findUnique({
          where: { email: identifier },
          select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
        })
        .catch(() => null)) || null

    if (!user?.id) {
      user =
        (await prisma.user
          .create({
            data: {
              email: identifier,
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
              ...(phone ? { phone } : {}),
              ...(emailVerified ? { emailVerifiedAt: new Date() } : {}),
            } as any,
            select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
          })
          .catch(() => null)) || null
    } else {
      const needsUpdate =
        (emailVerified && !user.emailVerifiedAt) || (!user.firstName && firstName) || (!user.lastName && lastName) || (!user.phone && phone)
      if (needsUpdate) {
        user =
          (await prisma.user
            .update({
              where: { id: user.id },
              data: {
                ...(emailVerified && !user.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
                ...(!user.firstName && firstName ? { firstName } : {}),
                ...(!user.lastName && lastName ? { lastName } : {}),
                ...(!user.phone && phone ? { phone } : {}),
              } as any,
              select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
            })
            .catch(() => null)) || user
      }
    }

    if (!user?.id) {
      return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
    }

    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email || identifier } },
      { status: 200, headers: { ...rlIp.headers, ...rlId.headers, 'Cache-Control': 'no-store' } }
    )
    }

    // 2) Admin/legacy users in `unity_users` table by username (seeded by `create_admin.py`).
    let rows: Array<{ id: number; username: string; hashed_password: string; is_active: boolean }> = []
    try {
      rows = await prisma.$queryRaw<
        Array<{ id: number; username: string; hashed_password: string; is_active: boolean }>
      >`select id, username, hashed_password, is_active from unity_users where lower(username) = ${identifier} limit 1`
    } catch {
      // Table may not exist in some environments; treat as invalid credentials.
      return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
    }
    const admin = rows?.[0]
    if (!admin?.id || !admin.is_active || !admin.hashed_password) {
      return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
    }

    const ok = await verifyPassword(password, admin.hashed_password)
    if (!ok) {
      return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: `unity:${admin.id}`,
          username: admin.username,
          email: `${String(admin.username || 'admin').toLowerCase()}@unitycredit.local`,
        },
      },
      { status: 200, headers: { ...rlIp.headers, ...rlId.headers, 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    return NextResponse.json({ error: toYiddishError(error?.message || '') }, { status: 500 })
  }
}

