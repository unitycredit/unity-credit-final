'use server'

import { createClient, createServerClient } from '@/lib/supabase'
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/validations'
import { createAuditLog } from '@/lib/security'
import { headers } from 'next/headers'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import { enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'

const toYiddishError = (msg: string) => {
  const text = msg || ''
  if (text.includes('User already registered')) return 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
  if (text.includes('Email not confirmed')) return 'אייער אימעיל איז נאך נישט וועריפיצירט. ביטע טשעקט אייער אימעיל.'
  if (text.includes('Invalid login credentials') || text.includes('Invalid email or password')) return 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.'
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

    // NOTE:
    // Server Actions cannot easily establish a NextAuth browser session (it requires the NextAuth callback flow + CSRF).
    // This action therefore only validates credentials against AWS RDS Postgres.
    const emailNorm = String(validation.data.email || '').trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
      select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
    })
    if (!user?.id || !user.passwordHash) return { error: 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.' }
    if (process.env.NODE_ENV === 'production' && !user.emailVerifiedAt) return { error: 'אייער אימעיל איז נאך נישט וועריפיצירט. ביטע טשעקט אייער אימעיל.' }
    const ok = await verifyPassword(String(validation.data.password || ''), user.passwordHash)
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

    // AWS RDS signup:
    // - Creates or upgrades a user row in Postgres (`users` table via Prisma).
    // - Password is stored as bcrypt hash in `password_hash`.
    // - Email verification is handled via OTP routes (also stored in Postgres).
    const email = String(validation.data.email || '').trim().toLowerCase()
    const firstName = String(validation.data.firstName || '').trim()
    const lastName = String(validation.data.lastName || '').trim()
    const phone = String(validation.data.phone || '').trim()

    // Hash password (bcrypt) - supported by `verifyPassword()` in `lib/auth.ts`.
    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(String(validation.data.password || ''), 12)

    let user = await prisma.user
      .findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true } })
      .catch(() => null)

    if (user?.passwordHash) {
      return { error: 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.' }
    }

    if (!user?.id) {
      user = await prisma.user.create({
        data: { email, firstName, lastName, phone, passwordHash },
        select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
      })
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firstName, lastName, phone, passwordHash },
        select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
      })
    }

    createAuditLog(user.id, 'USER_SIGNUP', 'auth', { email })

    // Trigger OTP immediately (server-side, best-effort) so users get the email even if they forget to click.
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
      const proto = h.get('x-forwarded-proto') || 'http'
      const base = `${proto}://${host}`
      await fetch(`${base}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' }),
        cache: 'no-store',
      })
    } catch {
      // ignore
    }

    return {
      success: true,
      user: { id: user.id, email: user.email } as any,
      needsVerification: !user.emailVerifiedAt,
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

