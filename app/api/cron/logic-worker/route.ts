import { NextRequest, NextResponse } from 'next/server'
import { popLogicJobId, readLogicJob, updateLogicJob } from '@/lib/logic-jobs'
import { enforceRateLimit } from '@/lib/server-rate-limit'

function hasCronAuth(req: NextRequest) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const h = String(req.headers.get('x-uc-cron-secret') || '').trim()
  return Boolean(h && h === secret)
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })
  if (!hasCronAuth(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const max = Math.max(1, Math.min(10, Number(req.nextUrl.searchParams.get('max') || 3)))
  const processed: Array<{ id: string; status: string }> = []

  for (let i = 0; i < max; i++) {
    const id = await popLogicJobId()
    if (!id) break
    const job = await readLogicJob(id)
    if (!job) continue
    if (job.status !== 'queued') continue

    await updateLogicJob(id, { status: 'running' })

    try {
      const url = new URL('/api/logic/process', req.url)
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uc-internal-secret': String(process.env.INTERNAL_JOB_SECRET || ''),
        },
        body: JSON.stringify({ question: job.question, context: job.context }),
        cache: 'no-store',
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        await updateLogicJob(id, { status: 'failed', error: String(json?.error || `HTTP ${resp.status}`), result: json })
        processed.push({ id, status: 'failed' })
        continue
      }
      await updateLogicJob(id, { status: 'succeeded', result: json })
      processed.push({ id, status: 'succeeded' })
    } catch (e: any) {
      await updateLogicJob(id, { status: 'failed', error: e?.message || 'Worker failed' })
      processed.push({ id, status: 'failed' })
    }
  }

  return NextResponse.json({ ok: true, processed }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


