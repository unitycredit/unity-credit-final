'use server'

import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/validations'
import { createAuditLog } from '@/lib/security'
import { headers } from 'next/headers'
import { enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

const toYiddishError = (msg: string) => {
  const text = msg || ''
  if (text.includes('User already registered')) return 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
  if (text.includes('Email not confirmed')) return 'אייער אימעיל איז נאך נישט וועריפיצירט. ביטע טשעקט אייער אימעיל.'
  if (text.includes('Invalid login credentials') || text.includes('Invalid email or password')) return 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.'
  if (text.includes('UsernameExistsException')) return 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
  if (text.includes('UserNotConfirmedException')) return 'אייער אימעיל איז נאך נישט באַשטעטיגט. ביטע וועריפיצירט.'
  if (text.includes('NotAuthorizedException')) return 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.'
  if (text.includes('Password')) return 'פאסווארט איז נישט שטארק גענוג. ביטע נוצט א שטארקערן פאסווארט.'
  if (text.includes('Too many requests')) return 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.'
  return 'א טעות איז פארגעקומען. פרובירט נאכאמאל אדער קאנטאקט סופּפּאָרט.'
}

export async function signInAction(data: LoginInput) {
  try {
    const validation = loginSchema.safeParse(data)
    if (!validation.success) {
      return { error: 'אומגילטיגע דאטן', details: validation.error.errors }
    }

    // Rate limit login attempts (per IP + per email hash) to prevent brute force.
    try {
      const h = await headers()
      const fakeReq = { headers: h } as any
      const xff = String(h.get('x-forwarded-for') || '').split(',')[0]?.trim()
      const real = String(h.get('x-real-ip') || '').trim()
      const cf = String(h.get('cf-connecting-ip') || '').trim()
      const ip = xff || real || cf || 'unknown'
      const emailNorm = String(validation.data.email || '').trim().toLowerCase()
      const eh = createHash('sha256').update(emailNorm).digest('hex').slice(0, 32)
      const ipLimit = await enforceRateLimitKeyed(fakeReq, 'LOGIN_ATTEMPTS', ip)
      const emailLimit = await enforceRateLimitKeyed(fakeReq, 'LOGIN_ATTEMPTS_EMAIL', eh)
      if (!ipLimit.allowed || !emailLimit.allowed) {
        return { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }
      }
    } catch {
      // fail open (auth availability > perfect limiting)
    }

    const emailNorm = String(validation.data.email || '').trim().toLowerCase()
    const password = String(validation.data.password || '')

    const hasDbEnv = Boolean(
      String(process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim() ||
        (String(process.env.DB_HOST || '').trim() && String(process.env.DB_PASSWORD || '').trim())
    )
    if (!hasDbEnv) return { error: 'סערוויר קאנפיגוראַציע טעות: דאַטאַבייס (RDS) איז נישט קאנפיגורירט. ביטע קאנטאקט סופּפּאָרט.' }

    const user =
      (await prisma.user
        .findUnique({
          where: { email: emailNorm },
          select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
        })
        .catch(() => null)) || null

    if (!user?.id || !user.passwordHash) return { error: 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.' }

    const requireVerified =
      process.env.NODE_ENV === 'production' && String(process.env.UC_REQUIRE_EMAIL_VERIFICATION || '').trim() !== 'false'
    if (requireVerified && !user.emailVerifiedAt) return { error: 'אייער אימעיל איז נאך נישט באַשטעטיגט. ביטע וועריפיצירט.' }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return { error: 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.' }

    createAuditLog(user.id, 'USER_LOGIN', 'auth', { email: user.email })
    return { success: true, user: { id: user.id, email: user.email } as any, nextAuthRequired: true }
  } catch (error: any) {
    return { error: toYiddishError(error?.message) }
  }
}

export async function signUpAction(data: SignupInput) {
  try {
    const validation = signupSchema.safeParse(data)
    if (!validation.success) {
      return { error: 'אומגילטיגע דאטן', details: validation.error.errors }
    }

    // AWS Cognito signup:
    // - Creates the identity in Cognito User Pool (Cognito sends the verification code email).
    // - Mirrors a local user row in AWS RDS Postgres (Prisma) for app data ownership.
    const email = String(validation.data.email || '').trim().toLowerCase()
    const firstName = String(validation.data.firstName || '').trim()
    const lastName = String(validation.data.lastName || '').trim()
    const phone = String(validation.data.phone || '').trim()
    const password = String(validation.data.password || '')

    const created = await callCognitoBoto3('sign_up', {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      phone,
    })
    if (!created.ok) return { error: toYiddishError(String((created as any)?.error_code || (created as any)?.error || '')) }

    // Best-effort mirror to RDS (Prisma). Do not block Cognito signup if DB is temporarily unavailable.
    let user: { id: string; email: string } | null = null
    try {
      const existing =
        (await prisma.user
          .findUnique({ where: { email }, select: { id: true, email: true } })
          .catch(() => null)) || null

      if (!existing?.id) {
        const createdRow =
          (await prisma.user
            .create({
              data: { email, firstName, lastName, phone } as any,
              select: { id: true, email: true },
            })
            .catch(() => null)) || null
        user = createdRow?.id ? { id: createdRow.id, email: createdRow.email || email } : null
      } else {
        const updatedRow =
          (await prisma.user
            .update({
              where: { id: existing.id },
              data: { firstName, lastName, phone } as any,
              select: { id: true, email: true },
            })
            .catch(() => null)) || null
        user = updatedRow?.id ? { id: updatedRow.id, email: updatedRow.email || email } : { id: existing.id, email: existing.email || email }
      }
    } catch {
      user = null
    }

    if (user?.id) {
      createAuditLog(user.id, 'USER_SIGNUP', 'auth', { email })
    }

    return {
      success: true,
      user: user?.id ? ({ id: user.id, email: user.email } as any) : ({ id: `cognito:${email}`, email } as any),
      needsVerification: true,
      autoLogin: false,
    }
  } catch (error: any) {
    return { error: toYiddishError(error?.message) }
  }
}

export async function signOutAction() {
  try {
    // Clear NextAuth session cookies (JWT strategy).
    const jar = await cookies()
    jar.set('next-auth.session-token', '', { path: '/', maxAge: 0 })
    jar.set('__Secure-next-auth.session-token', '', { path: '/', maxAge: 0 })
    return { success: true }
  } catch (error: any) {
    return { error: toYiddishError(error?.message) }
  }
}

export async function getCurrentUser() {
  try {
    // Prefer NextAuth session (JWT strategy).
    const { getServerSession } = await import('next-auth/next')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    const userId = String((session as any)?.user?.id || '').trim()
    if (!userId) return { user: null }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true },
    })
    if (!dbUser?.id) return { user: null }

    // Keep shape compatible with existing settings UI expectations.
    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        user_metadata: { first_name: dbUser.firstName || '', last_name: dbUser.lastName || '', phone: dbUser.phone || '' },
        profile: { first_name: dbUser.firstName || '', last_name: dbUser.lastName || '', phone: dbUser.phone || '' },
      } as any,
    }
  } catch (error: any) {
    return { user: null, error: toYiddishError(error?.message) }
  }
}

