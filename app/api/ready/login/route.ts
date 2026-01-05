import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { resendConfig } from '@/lib/email-queue'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import { unityBrainBaseUrl } from '@/lib/brain-handshake'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const resend = resendConfig()
  const supa = getSupabaseRuntimeConfig()
  const brainBase = unityBrainBaseUrl()

  // Health probe (reachability only; does not require app key).
  let brainReachable = false
  try {
    const u = new URL('/healthz', brainBase)
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), 1500)
    const r = await fetch(u, { method: 'GET', cache: 'no-store', signal: ctrl.signal }).finally(() => clearTimeout(id))
    brainReachable = r.ok
  } catch {
    brainReachable = false
  }

  // NOTE (Architectural pivot):
  // Unity Credit must NOT depend on Brain handshake/approval for basic app access.
  // Brain is optional and used only for insights.
  const ready = Boolean(resend.ok) && Boolean(supa.serviceRoleKey)

  if (ready) {
    // Print once per server process.
    const g: any = globalThis as any
    if (!g.__UC_BRAIN_SYNC_LOGGED__) {
      g.__UC_BRAIN_SYNC_LOGGED__ = true
      // eslint-disable-next-line no-console
      console.log(`🚀 UNITY CREDIT FRONTEND IS READY (Brain reachable=${brainReachable})`)
    }
  }

  return NextResponse.json(
    {
      ok: true,
      ready_for_first_user: ready,
      resend_configured: Boolean(resend.ok),
      supabase_service_role_configured: Boolean(supa.serviceRoleKey),
      brain_reachable: brainReachable,
      brain_state: brainReachable ? 'reachable' : 'unreachable',
      brain_base_url: brainBase,
      next: '/dashboard',
    },
    { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


