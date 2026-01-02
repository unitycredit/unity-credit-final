import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readAdminAlertConfig, writeAdminAlertConfig } from '@/lib/admin-alert-config'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

function bad(msgYi: string, status = 400) {
  return NextResponse.json({ ok: false, error: msgYi }, { status })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const cfg = await readAdminAlertConfig().catch(() => ({ owner_email: null, owner_phone: null, updated_at: null }))
  return NextResponse.json({ ok: true, config: cfg }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const body = (await req.json().catch(() => ({}))) as any
  const owner_email = sanitizeInput(String(body?.owner_email || '')).trim() || null
  const owner_phone = sanitizeInput(String(body?.owner_phone || '')).trim() || null
  const out = await writeAdminAlertConfig({ owner_email, owner_phone }).catch(() => null)
  if (!out?.ok) return bad('מען האט נישט געקענט זאווען.', 500)
  const cfg = await readAdminAlertConfig().catch(() => ({ owner_email: null, owner_phone: null, updated_at: null }))
  return NextResponse.json({ ok: true, config: cfg }, { headers: { 'Cache-Control': 'no-store' } })
}


