import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { readLogicJob } from '@/lib/logic-jobs'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const { id } = await ctx.params
  const job = await readLogicJob(String(id || '').trim())
  if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  if (String(job.user_id || '').trim() !== user.id) {
    // Do not leak existence across tenants.
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  }

  return NextResponse.json({ ok: true, job }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


