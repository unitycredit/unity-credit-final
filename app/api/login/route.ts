import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServerClient as createServiceRoleClient } from '@/lib/supabase'
import { loginSchema } from '@/lib/validations'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import { enforceRateLimit, enforceRateLimitKeyed } from '@/lib/server-rate-limit'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

const toYiddishError = (msg: string) => {
  if (msg.includes('Invalid login credentials') || msg.includes('Invalid email or password'))
    return 'אומגילטיגע אימעיל אדער פאסווארט. פרובירט נאכאמאל.'
  if (msg.includes('Email not confirmed')) return 'אייער אימעיל איז נאך נישט וועריפיצירט. ביטע טשעקט אייער אימעיל.'
  if (msg.includes('Too many requests')) return 'צו פיל פראבען. ביטע ווארט א ביסל און פרובירט ווידער.'
  return 'א טעות איז פארגעקומען. פרובירט נאכאמאל.'
}

/**
 * Unity Credit-owned login endpoint (no Brain dependency).
 * - Validates credentials against Supabase Auth (GoTrue)
 * - Establishes the browser session via Supabase auth cookies
 */
export async function POST(request: NextRequest) {
  try {
    const rlIp = await enforceRateLimit(request, 'LOGIN_ATTEMPTS')
    if (!rlIp.allowed) {
      return NextResponse.json({ error: toYiddishError('Too many requests') }, { status: 429, headers: rlIp.headers })
    }

    const cfg = getSupabaseRuntimeConfig()
    const supabaseUrl = String(cfg.url || '').trim()
    const anonKey = String(cfg.anonKey || '').trim()
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Missing Supabase keys.' }, { status: 500 })
    }

    const cookieOps: Array<{ type: 'set' | 'remove'; name: string; value?: string; options?: any }> = []
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieOps.push({ type: 'set', name, value, options })
        },
        remove(name: string, options: any) {
          cookieOps.push({ type: 'remove', name, options })
        },
      },
    })

    const body = await request.json()
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן', details: validation.error.errors }, { status: 400 })
    }

    const { email, password } = validation.data
    const eh = createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex').slice(0, 32)
    const rlEmail = await enforceRateLimitKeyed(request, 'LOGIN_ATTEMPTS_EMAIL', eh)
    if (!rlEmail.allowed) {
      return NextResponse.json(
        { error: toYiddishError('Too many requests') },
        { status: 429, headers: { ...rlIp.headers, ...rlEmail.headers } }
      )
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: toYiddishError(error.message) }, { status: 401, headers: { ...rlIp.headers, ...rlEmail.headers } })
    }

    if (data.user && !data.user.email_confirmed_at) {
      // Dev convenience: auto-confirm then retry login (keeps production strict).
      if (process.env.NODE_ENV !== 'production' && cfg.serviceRoleKey) {
        try {
          const admin = createServiceRoleClient()
          const lookup = await admin
            .from('users')
            .select('id')
            .ilike('email', String(email || '').trim().toLowerCase())
            .maybeSingle()
          const userId = (lookup as any)?.data?.id || null
          if (userId) {
            await admin.auth.admin.updateUserById(userId, { email_confirm: true } as any)
            const second = await supabase.auth.signInWithPassword({ email, password })
            if (second.error) return NextResponse.json({ error: toYiddishError(second.error.message) }, { status: 401 })
            if (second.data?.user && !second.data.user.email_confirmed_at) {
              return NextResponse.json({ error: toYiddishError('Email not confirmed') }, { status: 403 })
            }
          }
        } catch {
          // fall through
        }
      }
      return NextResponse.json({ error: toYiddishError('Email not confirmed') }, { status: 403 })
    }

    const response = NextResponse.json(
      {
        ok: true,
        user: {
          id: data.user?.id || null,
          email: data.user?.email || null,
          email_confirmed_at: (data.user as any)?.email_confirmed_at || null,
        },
      },
      { status: 200, headers: { ...rlIp.headers, ...rlEmail.headers } }
    )
    for (const op of cookieOps) {
      if (op.type === 'set') response.cookies.set({ name: op.name, value: String(op.value || ''), ...(op.options || {}) })
      else response.cookies.set({ name: op.name, value: '', ...(op.options || {}), maxAge: 0 })
    }
    return response
  } catch (error: any) {
    return NextResponse.json({ error: toYiddishError(error?.message || '') }, { status: 500 })
  }
}


