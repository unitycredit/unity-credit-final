import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readEmergencyControl, setEmergencySwitch } from '@/lib/emergency-control'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

function bad(msgYi: string, status = 400) {
  return NextResponse.json({ ok: false, error: msgYi }, { status })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const state = await readEmergencyControl().catch(() => null)
  return NextResponse.json({ ...(state || {}), ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const body = (await req.json().catch(() => ({}))) as any

  const key = sanitizeInput(String(body?.key || '')).trim()
  const enabled = Boolean(body?.enabled)
  const timer = sanitizeInput(String(body?.timer || '')).trim()
  const reason = sanitizeInput(String(body?.reason || '')).trim() || null

  if (!(key === 'global_site_access' || key === 'advice_engine' || key === 'email_dispatch')) {
    return bad('נישט־גילטיגע key.')
  }

  const hours = timer === '1h' ? 1 : timer === '2h' ? 2 : timer === '4h' ? 4 : null
  const out = await setEmergencySwitch({ key, enabled, timer_hours: hours as any, reason }).catch(() => null)
  if (!out?.ok) return bad('מען האט נישט געקענט אפדעיטן.', 500)

  const state = await readEmergencyControl().catch(() => null)
  return NextResponse.json({ ...(state || {}), ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}


