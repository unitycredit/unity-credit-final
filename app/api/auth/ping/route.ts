import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { enforceRateLimit } from '@/lib/server-rate-limit'

export const runtime = 'nodejs'

/**
 * Keepalive endpoint:
 * - Used by active dashboards to keep sessions fresh.
 * - Returns 401 if not logged in.
 */
export async function GET(req: NextRequest) {
  // Lightweight rate limit (same bucket as API_REQUESTS).
  const rl = await enforceRateLimit(req as any, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  try {
    const secret = process.env.NEXTAUTH_SECRET
    const token = secret ? await getToken({ req, secret }) : null
    const cookieNames = req.cookies.getAll().map((c) => c.name)
    const hasSessionCookie =
      cookieNames.includes('next-auth.session-token') || cookieNames.includes('__Secure-next-auth.session-token')

    if (!token && !hasSessionCookie) {
      return NextResponse.json({ ok: false }, { status: 401, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ ok: true }, { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
  }
}


