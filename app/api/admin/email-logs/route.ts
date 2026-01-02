import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 })

  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50)))
  const q = sanitizeInput(String(req.nextUrl.searchParams.get('q') || '')).trim().toLowerCase()
  const status = sanitizeInput(String(req.nextUrl.searchParams.get('status') || '')).trim().toLowerCase()

  let query = admin.from('email_logs').select('*').order('created_at', { ascending: false }).limit(limit)
  if (q && q.includes('@')) query = query.ilike('to_email', `%${q}%`)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'מען קען נישט לייענען אימעיל־לאָגס.' }, { status: 500 })

  return NextResponse.json({ ok: true, logs: Array.isArray(data) ? data : [] })
}


