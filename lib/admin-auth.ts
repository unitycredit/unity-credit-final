import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { resolveAdminSecret } from '@/lib/admin-secret'

export const ADMIN_COOKIE_NAME = 'uc_admin'
export const ADMIN_HMAC_SALT = 'uc_admin_v1'

export function adminToken(secret: string) {
  return createHmac('sha256', secret).update(ADMIN_HMAC_SALT).digest('hex')
}

export function safeEq(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return timingSafeEqual(aa, bb)
}

export function isAdminRequest(req: NextRequest) {
  const resolved = resolveAdminSecret(req)
  const secret = resolved.enabled ? resolved.secret : ''
  if (!secret) return false
  const token = adminToken(secret)
  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value || ''
  const headerSecret = req.headers.get('x-admin-secret') || ''
  return Boolean((cookieToken && safeEq(cookieToken, token)) || (headerSecret && safeEq(headerSecret, secret)))
}


