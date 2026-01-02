import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { resolveAdminSecret } from '@/lib/admin-secret'

function makeToken(secret: string) {
  return createHmac('sha256', secret).update('uc_admin_v1').digest('hex')
}

function safeEq(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return timingSafeEqual(aa, bb)
}

export async function POST(req: NextRequest) {
  const resolved = resolveAdminSecret(req)
  const secret = resolved.enabled ? resolved.secret : ''
  if (!secret) return NextResponse.json({ error: 'אַדמין איז נישט אַקטיוו.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as any))
  const password = String(body?.password || '')

  if (!safeEq(password, secret)) {
    return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  }

  const token = makeToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('uc_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 6, // 6 hours
  })
  return res
}


