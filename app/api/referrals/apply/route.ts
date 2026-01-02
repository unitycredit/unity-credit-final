import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any
  const raw = String(body?.code || '').trim()
  if (!raw || !/^[A-Za-z0-9_-]{4,32}$/.test(raw)) {
    return NextResponse.json({ error: 'Invalid referral code.' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true, code: raw })
  res.cookies.set('uc_ref', raw, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}


