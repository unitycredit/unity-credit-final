import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { readLogicJob, updateLogicJob } from '@/lib/logic-jobs'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  // Must be the logged-in user (jobs are scoped to auth; storage is opaque).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const { id } = await ctx.params
  const jobId = String(id || '').trim()
  const job = await readLogicJob(jobId)
  if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  if (String(job.user_id || '').trim() !== user.id) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  }

  if (job.status === 'succeeded') return NextResponse.json({ ok: true, status: job.status }, { headers: rl.headers })
  if (job.status === 'running') return NextResponse.json({ ok: true, status: job.status }, { headers: rl.headers })

  await updateLogicJob(jobId, { status: 'running' })

  // Execute the heavy work by calling the existing consensus route WITH the current request cookies.
  try {
    const url = new URL('/api/logic/process', req.url)
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.get('cookie') || '',
      },
      body: JSON.stringify({ question: job.question, context: job.context }),
      cache: 'no-store',
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      await updateLogicJob(jobId, { status: 'failed', error: String(json?.error || `HTTP ${resp.status}`), result: json })
      return NextResponse.json({ ok: false, error: json?.error || 'Job failed' }, { status: resp.status, headers: rl.headers })
    }
    await updateLogicJob(jobId, { status: 'succeeded', result: json })
    return NextResponse.json({ ok: true, status: 'succeeded' }, { headers: rl.headers })
  } catch (e: any) {
    await updateLogicJob(jobId, { status: 'failed', error: e?.message || 'Job failed' })
    return NextResponse.json({ ok: false, error: e?.message || 'Job failed' }, { status: 500, headers: rl.headers })
  }
}


