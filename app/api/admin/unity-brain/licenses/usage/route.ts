import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50)))
  const { data, error } = await admin
    .from('unity_brain_licenses')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) return bad('מען קען נישט לייענען Brain licenses.', 500)

  return NextResponse.json({ ok: true, rows: Array.isArray(data) ? data : [] }, { headers: { 'Cache-Control': 'no-store' } })
}


