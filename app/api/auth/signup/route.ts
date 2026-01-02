import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { signupSchema } from '@/lib/validations'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'


const toYiddishError = (msg: string) => {
  if (msg.includes('User already registered')) return 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
  if (msg.includes('Password')) return 'פאסווארט איז נישט שטארק גענוג. ביטע נוצט א שטארקערן פאסווארט.'
  return 'א טעות איז פארגעקומען. פרובירט נאכאמאל.'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן', details: validation.error.errors }, { status: 400 })
    }

    const { email, password, firstName, lastName, phone } = validation.data
    const referredBy = (validation.data as any).referralCode ? String((validation.data as any).referralCode).trim() : ''
    const cfg = getSupabaseRuntimeConfig()
    if (!cfg.serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            'סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY). לייגט עס אריין אין .env.local אדער (טעמפארער) אין DOTENV_LOCAL_TEMPLATE.txt און ריסטאַרט npm run dev.',
        },
        { status: 500 }
      )
    }

    // Enterprise: create user via service-role so Supabase does NOT send its own verification emails.
    // OTP is handled exclusively via Resend.
    const admin = createServerClient()
    let data: any = null
    let error: any = null

    const created = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone,
          ...(referredBy ? { referred_by: referredBy } : {}),
        },
      } as any)
      .catch((e: any) => ({ data: null, error: { message: e?.message || 'create failed' } }))

    data = (created as any)?.data || null
    error = (created as any)?.error || null

    if (error && String(error.message || '').includes('User already registered')) {
      try {
        const lookup = await admin.from('users').select('id').ilike('email', String(email || '').trim().toLowerCase()).maybeSingle()
        const existingId = (lookup as any)?.data?.id || null
        if (existingId) {
          const upd = await admin.auth.admin.updateUserById(existingId, {
            password,
            user_metadata: {
              first_name: firstName,
              last_name: lastName,
              phone,
              ...(referredBy ? { referred_by: referredBy } : {}),
            },
          } as any)
          data = (upd as any)?.data || null
          error = (upd as any)?.error || null
        }
      } catch {
        // keep original error
      }
    }

    if (error) {
      return NextResponse.json({ error: toYiddishError(error.message) }, { status: 400 })
    }

    // Ensure profile row exists (service role bypasses RLS).
    // If SUPABASE_SERVICE_ROLE_KEY is missing, skip this and rely on the DB trigger (if installed).
    if (cfg.serviceRoleKey) {
      try {
        await admin.from('users').upsert({
          id: data.user!.id,
          email: String(email || '').trim().toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          phone,
          ...(referredBy ? { referred_by: referredBy } : {}),
        })
      } catch {
        // Ignore: signup already succeeded
      }
    }

    // Trigger OTP immediately (server-side).
    try {
      const url = new URL('/api/auth/otp/send', request.url)
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup', user_id: data.user!.id }),
        cache: 'no-store',
      })
    } catch {
      // ignore
    }

    return NextResponse.json(
      { user: data.user, needsVerification: !data.user?.email_confirmed_at },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: toYiddishError(error?.message || '') }, { status: 500 })
  }
}

