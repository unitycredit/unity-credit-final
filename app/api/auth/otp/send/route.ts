import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { hashId, resendConfig, sendResendDirect } from '@/lib/email-queue'
import { otpEmail } from '@/lib/email-templates'
import { createHash, randomInt, randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import { issueDevOtp } from '@/lib/dev-otp-store'

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
  if (!rl.allowed) return NextResponse.json({ error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' }, { status: 429, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const email = sanitizeInput(String(body?.email || '')).trim()
  const purpose = String(body?.purpose || 'signup').trim()
  const hintedUserId = sanitizeInput(String(body?.user_id || '')).trim() || null

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'אומגילטיגע אימעיל אדרעס.' }, { status: 400, headers: rl.headers })
  }

  const eh = emailHash(email)
  const rlEmail = await enforceRateLimitKeyed(req, 'OTP_SEND_EMAIL', `${purpose}:${eh}`)
  if (!rlEmail.allowed) {
    // Prefer the stricter limiter if either trips.
    return NextResponse.json(
      { error: 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.' },
      { status: 429, headers: { ...rl.headers, ...rlEmail.headers } }
    )
  }
  const now = Date.now()

  const { ok: resendOk } = resendConfig()

  // Enterprise stack: OTP state is stored in Supabase (durable + indexed).
  const cfg = getSupabaseRuntimeConfig()
  if (!cfg.serviceRoleKey) {
    // Dev fallback: allow OTP to function without Supabase service role.
    if (process.env.NODE_ENV !== 'production') {
      const issued = await issueDevOtp({ email_hash: eh, purpose, ttlSeconds: OTP_TTL_SECONDS })
      // Still attempt to send via Resend if configured, so we can validate delivery end-to-end in dev.
      if (resendOk) {
        try {
          const emailContent = otpEmail({ code: issued.code, minutesValid: Math.round(OTP_TTL_SECONDS / 60) })
          await sendResendDirect({
            to: normalizeEmail(email),
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          })
          return NextResponse.json(
            {
              ok: true,
              queued: false,
              sent: true,
              job_id: null,
              expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
              ttl_seconds: OTP_TTL_SECONDS,
              resend_configured: true,
              supabase_service_role_configured: false,
              warning: 'DEV OTP: stored locally (no Supabase), but sent via Resend.',
            },
            { status: 200, headers: rl.headers }
          )
        } catch (e: any) {
          return NextResponse.json(
            {
              ok: true,
              queued: false,
              sent: false,
              job_id: null,
              debug_code: issued.code,
              resend_configured: true,
              supabase_service_role_configured: false,
              warning: 'DEV OTP: SUPABASE_SERVICE_ROLE_KEY missing; Resend dispatch failed; returning debug_code.',
              details: e?.message || null,
            },
            { status: 200, headers: rl.headers }
          )
        }
      }

      return NextResponse.json(
        {
          ok: true,
          queued: false,
          sent: false,
          job_id: null,
          debug_code: issued.code,
          resend_configured: resendOk,
          supabase_service_role_configured: false,
          warning: 'DEV OTP: SUPABASE_SERVICE_ROLE_KEY missing; using local dev OTP store.',
        },
        { status: 200, headers: rl.headers }
      )
    }
    return NextResponse.json({ error: 'סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })
  }

  const admin = createServerClient()

  // Resolve user id (must exist for email confirmation).
  let userId = hintedUserId
  if (!userId) {
    try {
      const lookup = await admin.from('users').select('id').ilike('email', normalizeEmail(email)).maybeSingle()
      userId = (lookup as any)?.data?.id || null
    } catch {
      userId = null
    }
  }
  if (!userId) {
    // Enterprise UX: if the user doesn't exist yet, create a placeholder auth user now
    // so we can send OTP immediately when the email is entered.
    // The full signup flow will later update password + metadata.
    try {
      const tmpPassword = `tmp-${randomUUID()}-${randomInt(100_000, 9_999_999)}`
      const created = await admin.auth.admin.createUser({
        email: normalizeEmail(email),
        password: tmpPassword,
        email_confirm: false,
        user_metadata: {},
      } as any)
      userId = (created as any)?.data?.user?.id || null
      if (userId) {
        // Ensure public.users has email for fast lookups.
        try {
          await admin.from('users').upsert({ id: userId, email: normalizeEmail(email) } as any)
        } catch {
          // ignore
        }
      }
    } catch {
      userId = null
    }
    if (!userId) {
      // Keep response generic (do not leak existence/state).
      return NextResponse.json({ ok: true, queued: false }, { status: 200, headers: rl.headers })
    }
  }

  // Throttle: do not issue more than 1 OTP per minute per email+purpose.
  const recent = await admin
    .from('uc_email_otps')
    .select('created_at')
    .eq('email_hash', eh)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastCreatedAt = recent?.data?.created_at ? Date.parse(String(recent.data.created_at)) : 0
  if (lastCreatedAt && now - lastCreatedAt < OTP_QUEUE_DEDUPE_SECONDS * 1000) {
    return NextResponse.json({ ok: true, queued: false, reason: 'throttled' }, { status: 200, headers: rl.headers })
  }

  const code = makeCode()
  const salt = String(randomInt(100_000, 9_999_999))
  const code_hash = hashOtp(code, salt)

  // Store OTP in Supabase (atomic: consume previous + insert new).
  const issued = await admin.rpc('uc_issue_email_otp', {
    p_user_id: userId,
    p_email: normalizeEmail(email),
    p_email_hash: eh,
    p_purpose: purpose,
    p_salt: salt,
    p_code_hash: code_hash,
    p_ttl_seconds: OTP_TTL_SECONDS,
  } as any)
  if (issued.error) {
    return NextResponse.json({ error: 'א טעות איז פארגעקומען. פרובירט נאכאמאל.' }, { status: 500, headers: rl.headers })
  }

  const emailContent = otpEmail({ code, minutesValid: Math.round(OTP_TTL_SECONDS / 60) })
  const jobId = hashId(['otp', purpose, eh, String(now)])
  const queuedAt = new Date().toISOString()
  const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000).toISOString()

  // If email provider isn't configured, still allow dev flows to proceed by returning a debug code.
  // (We still store OTP in Supabase so `/api/auth/otp/verify` works normally.)
  if (!resendOk) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          ok: true,
          queued: false,
          sent: false,
          job_id: null,
          queued_at: queuedAt,
          debug_code: code,
          warning: 'RESEND not configured; returning debug_code in dev.',
        },
        { status: 200, headers: rl.headers }
      )
    }
    return NextResponse.json({ error: 'אימעיל־סערוויס איז נישט קאנפיגורירט (RESEND_API_KEY/RESEND_FROM).' }, { status: 500, headers: rl.headers })
  }

  // OTP should arrive within seconds. To prevent queue-induced delays (or missing workers),
  // OTP is sent on a fast-path direct dispatch.
  try {
    const sent = await sendResendDirect({
      to: normalizeEmail(email),
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    })
    // Best-effort log to email_logs (same schema used by queue worker).
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const admin2 = createServerClient()
        await admin2.from('email_logs').upsert(
          {
            id: jobId,
            provider: 'resend',
            kind: 'otp',
            to_email: normalizeEmail(email),
            subject: emailContent.subject,
            status: 'sent',
            resend_id: String((sent as any)?.id || (sent as any)?.data?.id || ''),
            meta: { kind: 'otp', purpose, email_hash: eh },
            queued_at: queuedAt,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        )
      }
    } catch {
      // ignore logging failures
    }
    return NextResponse.json(
      {
        ok: true,
        queued: false,
        sent: true,
        job_id: jobId,
        queued_at: queuedAt,
        expires_at: expiresAt,
        ttl_seconds: OTP_TTL_SECONDS,
        resend_configured: true,
        supabase_service_role_configured: true,
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


