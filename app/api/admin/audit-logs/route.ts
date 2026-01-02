import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readVerificationAudit } from '@/lib/audit-trail'

export const runtime = 'nodejs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)

  const limit = Math.max(1, Math.min(2000, Number(req.nextUrl.searchParams.get('limit') || 300)))
  const audit = await readVerificationAudit(limit).catch(() => null)
  if (!audit) return bad('מען קען נישט לייענען audit logs.', 500)

  return NextResponse.json(
    {
      ok: true,
      storage: audit.storage,
      encrypted: audit.encrypted,
      logs: audit.logs,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


