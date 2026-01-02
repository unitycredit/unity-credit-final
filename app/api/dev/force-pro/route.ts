import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * DEV-ONLY helper: sets uc_tier=pro cookie so the UI can unlock Pro surfaces for a test user.
 * Protected by: NODE_ENV !== 'production'
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const res = NextResponse.json({ ok: true, tier: 'pro' }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  res.cookies.set('uc_tier', 'pro', { httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 })
  return res
}


