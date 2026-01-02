import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const ADMIN_CENTER_COOKIE = 'uc_admin_center'
const SALT = 'uc_admin_center_v1'

function safeEq(a: string, b: string) {
  const aa = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  if (aa.length !== bb.length) return false
  return timingSafeEqual(aa, bb)
}

function secretFromEnv() {
  return (
    String(process.env.ADMIN_CENTER_SECRET || '').trim() ||
    String(process.env.ADMIN_SECRET || '').trim() ||
    // Dev fallback (still HMAC-signed, but not a real secret).
    'dev_admin_center_secret_change_me'
  )
}

export function expectedAdminCenterPin() {
  return String(process.env.ADMIN_CENTER_PIN || '123456').trim()
}

export function signAdminCenterCookie(expiresAtMs: number) {
  const secret = secretFromEnv()
  const exp = String(Math.floor(expiresAtMs))
  const sig = createHmac('sha256', secret).update(`${SALT}|${exp}`).digest('hex')
  return `${exp}.${sig}`
}

export function isAdminCenterRequest(req: NextRequest) {
  const raw = String(req.cookies.get(ADMIN_CENTER_COOKIE)?.value || '')
  const [expStr, sig] = raw.split('.')
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false
  const secret = secretFromEnv()
  const expectedSig = createHmac('sha256', secret).update(`${SALT}|${String(Math.floor(exp))}`).digest('hex')
  return Boolean(sig && safeEq(sig, expectedSig))
}


