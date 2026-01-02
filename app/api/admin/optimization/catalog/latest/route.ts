import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createAdminClient } from '@/lib/supabase-admin'

const REDIS_KEY = 'uc:catalog:latest'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  if (upstashEnabled()) {
    const cached = await upstashCmd<string>(['GET', REDIS_KEY]).catch(() => null)
    const raw = String((cached as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        return NextResponse.json({ ok: true, source: 'redis', ...parsed })
      } catch {
        // ignore
      }
    }
  }

  const table = String(process.env.OPTIMIZATION_TABLE_NAME || 'optimization')
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('kind', 'heimishe_catalog')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const row = Array.isArray(data) ? data[0] : null
  return NextResponse.json({ ok: true, source: 'supabase', row })
}


