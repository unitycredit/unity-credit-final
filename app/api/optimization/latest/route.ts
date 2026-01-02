import { NextRequest, NextResponse } from 'next/server'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const KEY = 'uc:opt:latest'

export async function GET(_req: NextRequest) {
  const rl = await enforceRateLimit(_req, 'OPTIMIZATION_READS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  // Prefer Redis for low-latency, high-traffic reads.
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const res = NextResponse.json({ ok: true, source: 'redis', ...parsed }, { headers: rl.headers })
        res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
        return res
      } catch {
        // fall through
      }
    }
  }

  // Dev fallback: local file
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'optimization_latest.json'), 'utf8')
    const parsed = JSON.parse(raw)
    const res = NextResponse.json({ ok: true, source: 'file', ...parsed }, { headers: rl.headers })
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
    return res
  } catch {
    const res = NextResponse.json({ ok: false, error: 'No optimization snapshot available yet.' }, { status: 404, headers: rl.headers })
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=5, stale-while-revalidate=30')
    return res
  }
}


