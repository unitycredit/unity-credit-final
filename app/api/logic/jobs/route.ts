import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createLogicJob, logicJobsEnabled } from '@/lib/logic-jobs'
import { hasPaidAccess } from '@/app/api/billing/_util'

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  if (!logicJobsEnabled()) {
    return NextResponse.json({ ok: false, error: 'Logic jobs require Upstash Redis' }, { status: 503, headers: rl.headers })
  }

  const access = await hasPaidAccess(req)
  if (!access.ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })
  if (!access.access) return NextResponse.json({ ok: false, error: 'Premium required' }, { status: 402, headers: rl.headers })

  const body = (await req.json().catch(() => ({}))) as any
  const question = String(body?.question || '').trim()
  const context = body?.context || null
  if (!question) return NextResponse.json({ ok: false, error: 'Missing question' }, { status: 400, headers: rl.headers })

  const user_id = String(access.ident?.user_id || '').trim()
  if (!user_id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const job = await createLogicJob({ question, context, user_id } as any)
  return NextResponse.json({ ok: true, job_id: job.id }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


