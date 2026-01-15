import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { loginFlexibleSchema } from '@/lib/validations'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'

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

    const hasDbEnv = Boolean(
      String(process.env.DATABASE_URL || '').trim() || (String(process.env.DB_HOST || '').trim() && String(process.env.DB_PASSWORD || '').trim())
    )
    if (!hasDbEnv) {
      // eslint-disable-next-line no-console
      console.error('[AUTH_LOGIN_API] DB_NOT_CONFIGURED', {
        hasDatabaseUrl: Boolean(String(process.env.DATABASE_URL || '').trim()),
        hasDbHost: Boolean(String(process.env.DB_HOST || '').trim()),
        hasDbPassword: Boolean(String(process.env.DB_PASSWORD || '').trim()),
      })
      return NextResponse.json(
        { error: 'סערוויר קאנפיגוראַציע טעות: דאַטאַבייס (RDS) איז נישט קאנפיגורירט. ביטע קאנטאקט סופּפּאָרט.', error_code: 'DB_NOT_CONFIGURED' },
        { status: 500, headers: { ...rlIp.headers, ...rlId.headers } }
      )
    }

    const isEmail = identifier.includes('@')

    // 1) Primary: RDS users table by email (no Cognito).
    if (isEmail) {
      let dbUser: { id: string; email: string | null; passwordHash: string | null; emailVerifiedAt: Date | null } | null = null
      try {
        dbUser = await prisma.user.findUnique({
          where: { email: identifier },
          select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
        })
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[AUTH_LOGIN_API] DB query failed (users by email)', {
          email: identifier,
          error: String(e?.message || e),
        })
        return NextResponse.json(
          { error: 'דאַטאַבייס פארבינדונג טעות. ביטע פרובירט נאכאמאל.', error_code: 'DB_CONNECT_FAILED' },
          { status: 500, headers: { ...rlIp.headers, ...rlId.headers } }
        )
      }

      if (!dbUser?.id || !dbUser.passwordHash) {
        // eslint-disable-next-line no-console
        console.warn('[AUTH_LOGIN_API] User not found or missing passwordHash', { email: identifier })
        return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
      }

      const requireVerified =
        process.env.NODE_ENV === 'production' && String(process.env.UC_REQUIRE_EMAIL_VERIFICATION || '').trim() !== 'false'
      if (requireVerified && !dbUser.emailVerifiedAt) {
        return NextResponse.json(
          { error: toYiddishError('EMAIL_NOT_VERIFIED'), error_code: 'EMAIL_NOT_VERIFIED' },
          { status: 403, headers: { ...rlIp.headers, ...rlId.headers } }
        )
      }

      const ok = await verifyPassword(password, dbUser.passwordHash)
      if (!ok) {
        // eslint-disable-next-line no-console
        console.warn('[AUTH_LOGIN_API] Password mismatch (email login)', {
          email: identifier,
          hashPrefix: String(dbUser.passwordHash || '').slice(0, 20),
        })
        return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
      }

      return NextResponse.json(
        { ok: true, user: { id: dbUser.id, email: dbUser.email || identifier } },
        { status: 200, headers: { ...rlIp.headers, ...rlId.headers, 'Cache-Control': 'no-store' } }
      )
    }

    // 2) Admin/legacy users in `unity_users` table by username (seeded by `create_admin.py`).
    let rows: Array<{ id: number; username: string; hashed_password: string; is_active: boolean }> = []
    try {
      rows = await prisma.$queryRaw<
        Array<{ id: number; username: string; hashed_password: string; is_active: boolean }>
      >`select id, username, hashed_password, is_active from unity_users where lower(username) = ${identifier} limit 1`
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[AUTH_LOGIN_API] DB query failed (unity_users by username)', {
        username: identifier,
        error: String(e?.message || e),
      })
      return NextResponse.json(
        { error: 'דאַטאַבייס פארבינדונג טעות. ביטע פרובירט נאכאמאל.', error_code: 'DB_CONNECT_FAILED' },
        { status: 500, headers: { ...rlIp.headers, ...rlId.headers } }
      )
    }
    const admin = rows?.[0]
    if (!admin?.id || !admin.is_active || !admin.hashed_password) {
      // eslint-disable-next-line no-console
      console.warn('[AUTH_LOGIN_API] Admin user missing/inactive', { username: identifier, found: Boolean(admin?.id) })
      return NextResponse.json({ error: toYiddishError('Invalid') }, { status: 401, headers: { ...rlIp.headers, ...rlId.headers } })
    }

    const ok = await verifyPassword(password, admin.hashed_password)
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn('[AUTH_LOGIN_API] Password mismatch (unity_users login)', {
        username: identifier,
        hashPrefix: String(admin.hashed_password || '').slice(0, 20),
      })
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
    const msg = String(error?.message || '')
    // eslint-disable-next-line no-console
    console.error('[AUTH_LOGIN_API] Unhandled error', { error: msg, stack: String(error?.stack || '').slice(0, 2000) })
    if (msg.includes('Missing DATABASE_URL') || msg.includes('DB_HOST') || msg.includes('Prisma')) {
      return NextResponse.json(
        { error: 'סערוויר קאנפיגוראַציע טעות: דאַטאַבייס (RDS) איז נישט קאנפיגורירט. ביטע קאנטאקט סופּפּאָרט.', error_code: 'DB_NOT_CONFIGURED' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: toYiddishError(msg) }, { status: 500 })
  }
}

