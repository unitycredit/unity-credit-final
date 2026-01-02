import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@/lib/supabase'
import { queueRawEmail } from '@/lib/email-queue'
import { welcomeEmail } from '@/lib/email-templates'
import { createHash } from 'node:crypto'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import { verifyDevOtp } from '@/lib/dev-otp-store'
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

  const cfg = getSupabaseRuntimeConfig()

  // DEV BACKDOOR (testing only): if email service isn't active yet, allow a fixed test login.
  // Credentials: test@unity.com + 123456
  // This sets the existing dev bypass cookie so the user can enter /dashboard immediately.
  const emailProviderReady = resendConfig().ok
  const isDev = process.env.NODE_ENV !== 'production'
  const normalizedEmail = normalizeEmail(email)
  const backdoorUsed = String(req.cookies.get('uc_backdoor_used')?.value || '').trim() === '1'
  if (isDev && !backdoorUsed && (!emailProviderReady || !cfg.serviceRoleKey) && normalizedEmail === 'test@unity.com' && code === '123456') {
    const res = NextResponse.json(
      { ok: true, verified: true, session: true, redirect_to: '/dashboard', warning: 'DEV BACKDOOR: test@unity.com accepted.' },
      { status: 200, headers: rl.headers }
    )
    res.cookies.set('uc_dev_bypass', '1', { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 })
    res.cookies.set('uc_backdoor_used', '1', { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
    return res
  }

  if (!cfg.serviceRoleKey) {
    // Dev fallback: verify against local dev OTP store.
    if (process.env.NODE_ENV !== 'production') {
      const eh = emailHash(email)
      const verified = await verifyDevOtp({ email_hash: eh, purpose, code, maxAttempts: MAX_VERIFY_ATTEMPTS })
      if (!verified.ok) {
        return NextResponse.json({ error: 'אומגילטיגער קאָד אדער דער קאָד איז אויסגעגאנגען.' }, { status: 400, headers: rl.headers })
      }
      // Dev-only: set the existing middleware bypass cookie so the user can enter /dashboard
      // and test the "full entrance" flow without Supabase service role configured.
      const res = NextResponse.json(
        { ok: true, verified: true, session: true, redirect_to: '/dashboard', warning: 'DEV OTP: verified via local dev OTP store (dev bypass session).' },
        { status: 200, headers: rl.headers }
      )
      res.cookies.set('uc_dev_bypass', '1', {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60,
      })
      return res
    }
    return NextResponse.json({ error: 'סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })
  }

  const eh = emailHash(email)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_VERIFY_EMAIL', `${purpose}:${eh}`)
  if (!rlEmail.allowed) {
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  const admin = createServerClient()

  // Atomic verify in DB (attempts + consume).
  const verified = await admin.rpc('uc_verify_email_otp', {
    p_email_hash: eh,
    p_purpose: purpose,
    p_code: code,
    p_max_attempts: MAX_VERIFY_ATTEMPTS,
  } as any)

  const ok = Array.isArray((verified as any)?.data) ? Boolean((verified as any).data[0]?.ok) : Boolean((verified as any)?.data?.ok)
  const userIdRaw =
    Array.isArray((verified as any)?.data) ? (verified as any).data[0]?.user_id : (verified as any)?.data?.user_id
  const userId: string | null = sanitizeInput(String(userIdRaw || '')).trim() || null

  if (!ok || !userId) {
    // Provide a clearer reason without leaking whether the user exists.
    // We inspect the latest OTP row for this email_hash+purpose to distinguish:
    // - expired / used
    // - too many attempts (locked)
    // - incorrect
    let reason: 'expired' | 'incorrect' | 'locked' | 'unknown' = 'unknown'
    try {
      const latest = await admin
        .from('uc_email_otps')
        .select('attempts,expires_at,consumed_at,created_at')
        .eq('email_hash', eh)
        .eq('purpose', purpose)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const row: any = (latest as any)?.data || null
      const now = Date.now()
      const exp = row?.expires_at ? Date.parse(String(row.expires_at)) : 0
      const consumed = Boolean(row?.consumed_at)
      const attempts = Number(row?.attempts || 0)
      if (consumed) reason = 'expired'
      else if (exp && exp <= now) reason = 'expired'
      else if (attempts >= MAX_VERIFY_ATTEMPTS) reason = 'locked'
      else reason = 'incorrect'
    } catch {
      reason = 'unknown'
    }

    const msg =
      reason === 'expired'
        ? 'דער קאָד איז אויסגעגאנגען. ביטע דריקט "שיק נאכאמאל" און נוצט דעם נייעם קאָד.'
        : reason === 'locked'
        ? 'צו פיל פרובירן. ביטע ווארט א ביסל און פרובירט ווידער (אדער שיקט א נייעם קאָד).'
        : 'אומגילטיגער קאָד. ביטע קאָנטראָלירט די 6 ציפערן און פרובירט נאכאמאל.'

    return NextResponse.json(
      { ok: false, error: msg, error_code: reason },
      { status: 400, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }

  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true } as any)
    if (error) {
      return NextResponse.json({ error: 'א טעות איז פארגעקומען ביים באַשטעטיגן אייער אימעיל.' }, { status: 500, headers: rl.headers })
    }
  } catch {
    return NextResponse.json({ error: 'א טעות איז פארגעקומען ביים באַשטעטיגן אייער אימעיל.' }, { status: 500, headers: rl.headers })
  }

  // Create an authenticated browser session (so the user lands on /dashboard after OTP).
  // We do this by generating a Supabase magiclink token_hash and verifying it server-side
  // using the SSR client (which sets the auth cookies).
  try {
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim() || new URL(req.url).origin
    const link = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizeEmail(email),
      options: { redirectTo: `${appUrl.replace(/\/+$/, '')}/dashboard` },
    } as any)
    const token_hash = String((link as any)?.data?.properties?.hashed_token || '').trim()
    if (!token_hash) {
      return NextResponse.json({ error: 'Unable to create session (missing token_hash).' }, { status: 500, headers: { ...rl.headers, ...rlEmail.headers } })
    }

    const supabase = await createClient()
    const verified2 = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' } as any)
    if (verified2.error) {
      return NextResponse.json(
        { error: 'Unable to create session.', details: verified2.error.message },
        { status: 500, headers: { ...rl.headers, ...rlEmail.headers } }
      )
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Unable to create session.', details: e?.message || null },
      { status: 500, headers: { ...rl.headers, ...rlEmail.headers } }
    )
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

  return NextResponse.json({ ok: true, verified: true, session: true, redirect_to: '/dashboard' }, { status: 200, headers: { ...rl.headers, ...rlEmail.headers } })
}


