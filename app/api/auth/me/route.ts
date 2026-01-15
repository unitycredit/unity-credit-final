import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Prefer decoding NextAuth JWT if NEXTAUTH_SECRET is set.
    const secret = process.env.NEXTAUTH_SECRET
    const token = secret ? await getToken({ req, secret }) : null

    // Fallback (dev): if secret isn't set, treat cookie presence as logged-in.
    const cookieNames = req.cookies.getAll().map((c) => c.name)
    const hasSessionCookie =
      cookieNames.includes('next-auth.session-token') || cookieNames.includes('__Secure-next-auth.session-token')

    if (!token && !hasSessionCookie) {
      return NextResponse.json({ ok: false, user: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: String((token as any)?.uid || (token as any)?.sub || ''),
          email: String((token as any)?.email || ''),
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ ok: false, user: null }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}


