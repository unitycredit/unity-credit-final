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
    const referredBy = (validation.data as any).referralCode ? String((validation.data as any).referralCode).trim() : ''
    const isDev = process.env.NODE_ENV !== 'production'

    const cfg = getSupabaseRuntimeConfig()
    if (!cfg.serviceRoleKey) {
      // Dev fallback: allow signup flow to proceed to OTP verification even when service-role is missing.
      // OTP routes will store/verify locally in dev.
      if (process.env.NODE_ENV !== 'production') {
        try {
          const h = await headers()
          const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3002'
          const proto = h.get('x-forwarded-proto') || 'http'
          const base = `${proto}://${host}`
          await fetch(`${base}/api/auth/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: validation.data.email,
              purpose: 'signup',
              user_id: null,
            }),
            cache: 'no-store',
          })
        } catch {
          // ignore
        }
        return {
          success: true,
          demo: true,
          user: { id: 'dev-demo', email: validation.data.email, email_confirmed_at: null } as any,
          needsVerification: true,
        }
      }
      return {
        error:
          'סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY). לייגט עס אריין אין .env.local אדער (טעמפארער) אין DOTENV_LOCAL_TEMPLATE.txt און ריסטאַרט npm run dev.',
      }
    }

    // Enterprise: create user via service-role so Supabase does NOT send its own verification emails.
    // We handle OTP exclusively via Resend.
    const admin = createServerClient()
    let authData: any = null
    let error: any = null

    const createAttempt = await admin.auth.admin
      .createUser({
        email: validation.data.email,
        password: validation.data.password,
        email_confirm: false,
        user_metadata: {
          first_name: validation.data.firstName,
          last_name: validation.data.lastName,
          phone: validation.data.phone,
          ...(referredBy ? { referred_by: referredBy } : {}),
        },
      } as any)
      .catch((e: any) => ({ data: null, error: { message: e?.message || 'create failed' } }))

    authData = (createAttempt as any)?.data || null
    error = (createAttempt as any)?.error || null

    // If the email was pre-registered via OTP (placeholder user), upgrade it instead of failing.
    if (error && String(error.message || '').includes('User already registered')) {
      try {
        const lookup = await admin
          .from('users')
          .select('id')
          .ilike('email', String(validation.data.email || '').trim().toLowerCase())
          .maybeSingle()
        const existingId = (lookup as any)?.data?.id || null
        if (existingId) {
          const upd = await admin.auth.admin.updateUserById(existingId, {
            password: validation.data.password,
            user_metadata: {
              first_name: validation.data.firstName,
              last_name: validation.data.lastName,
              phone: validation.data.phone,
              ...(referredBy ? { referred_by: referredBy } : {}),
            },
          } as any)
          authData = (upd as any)?.data || null
          error = (upd as any)?.error || null
        }
      } catch {
        // keep original error
      }
    }

    if (error) return { error: toYiddishError(error.message) }

    if (authData.user) {
      // Ensure profile row exists using service role.
      if (cfg.serviceRoleKey) {
        try {
          const supabaseAdmin = createServerClient()
          await supabaseAdmin.from('users').upsert({
            id: authData.user.id,
            email: String(validation.data.email || '').trim().toLowerCase(),
            first_name: validation.data.firstName,
            last_name: validation.data.lastName,
            phone: validation.data.phone,
            ...(referredBy ? { referred_by: referredBy } : {}),
          })
        } catch {
          // Intentionally ignore: auth signup already succeeded
        }
      }
      createAuditLog(authData.user.id, 'USER_SIGNUP', 'auth', { email: validation.data.email })
    }

    // Dev convenience: auto-confirm + auto-login immediately after signup.
    // This establishes an auth session cookie so the user can enter /dashboard without a manual login step.
    // In production, keep the OTP verification flow (do not auto-confirm).
    let autoLogin = false
    if (isDev && authData.user?.id) {
      try {
        await admin.auth.admin.updateUserById(authData.user.id, { email_confirm: true } as any)
      } catch {
        // ignore
      }
      try {
        const supabase = await createClient()
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: validation.data.email,
          password: validation.data.password,
        })
        autoLogin = !signInErr
      } catch {
        autoLogin = false
      }
    }

    // Trigger OTP immediately (server-side, highest reliability).
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
      const proto = h.get('x-forwarded-proto') || 'http'
      const base = `${proto}://${host}`
      await fetch(`${base}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: validation.data.email,
          purpose: 'signup',
          user_id: authData.user?.id || null,
        }),
        cache: 'no-store',
      })
    } catch {
      // ignore (user can click resend on /verify-email)
    }

    return {
      success: true,
      user: authData.user,
      needsVerification: isDev && autoLogin ? false : !authData.user?.email_confirmed_at,
      autoLogin,
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
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null }
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    return { user: { ...user, profile } }
  } catch (error: any) {
    return { user: null, error: toYiddishError(error?.message) }
  }
}

