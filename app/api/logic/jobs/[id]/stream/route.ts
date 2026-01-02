import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { readLogicJob } from '@/lib/logic-jobs'
import { createClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function sseEvent(params: { event?: string; data: any }) {
  const name = params.event ? `event: ${params.event}\n` : ''
  const payload = `data: ${JSON.stringify(params.data)}\n\n`
  return name + payload
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const { id } = await ctx.params
  const jobId = String(id || '').trim()
  if (!jobId) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400, headers: rl.headers })

  // Validate tenancy once up front (and again in the loop, since jobs may expire).
  const initial = await readLogicJob(jobId)
  if (!initial) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  if (String((initial as any)?.user_id || '').trim() !== user.id) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: rl.headers })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastStatus = ''
      let lastUpdatedAt = ''
      const started = Date.now()

      // Initial event
      controller.enqueue(encoder.encode(sseEvent({ event: 'job', data: { ok: true, job: initial } })))
      lastStatus = String((initial as any)?.status || '')
      lastUpdatedAt = String((initial as any)?.updated_at || '')

      while (!req.signal.aborted) {
        // Hard timeout so we don't hold serverless functions open forever.
        if (Date.now() - started > 60_000) {
          controller.enqueue(encoder.encode(sseEvent({ event: 'timeout', data: { ok: false, error: 'timeout' } })))
          break
        }

        await sleep(750)

        const job = await readLogicJob(jobId)
        if (!job) {
          controller.enqueue(encoder.encode(sseEvent({ event: 'gone', data: { ok: false, error: 'gone' } })))
          break
        }
        if (String((job as any)?.user_id || '').trim() !== user.id) {
          controller.enqueue(encoder.encode(sseEvent({ event: 'gone', data: { ok: false, error: 'gone' } })))
          break
        }

        const status = String((job as any)?.status || '')
        const updated_at = String((job as any)?.updated_at || '')
        const changed = status !== lastStatus || updated_at !== lastUpdatedAt

        if (changed) {
          controller.enqueue(encoder.encode(sseEvent({ event: 'job', data: { ok: true, job } })))
          lastStatus = status
          lastUpdatedAt = updated_at
        } else {
          // heartbeat (prevents some proxies from closing idle connections)
          controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'))
        }

        if (status === 'succeeded' || status === 'failed') break
      }

      try {
        controller.close()
      } catch {
        // ignore
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      ...rl.headers,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}


