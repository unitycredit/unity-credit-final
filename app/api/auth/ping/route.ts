import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { enforceRateLimit } from '@/lib/server-rate-limit'

export const runtime = 'nodejs'

/**
 * Keepalive endpoint:
 * - Used by active dashboards to keep Supabase session cookies fresh.
 * - Returns 401 if not logged in.
 */
export async function GET(req: Request) {
  // Lightweight rate limit (same bucket as API_REQUESTS).
  const rl = await enforceRateLimit(req as any, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ ok: true }, { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }
}


