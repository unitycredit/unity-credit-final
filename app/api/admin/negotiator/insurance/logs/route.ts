import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const LOG_LIST_KEY = 'uc:negotiator:insurance:logs'
const LOG_FILE = path.join(process.cwd(), '.data', 'negotiator_insurance_logs.jsonl')

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50)))

  if (upstashEnabled()) {
    const resp = await upstashCmd<string[]>(['LRANGE', LOG_LIST_KEY, 0, limit - 1]).catch(() => null)
    const raw = Array.isArray((resp as any)?.result) ? ((resp as any).result as any[]) : []
    const logs = raw
      .map((l) => {
        try {
          return JSON.parse(String(l || ''))
        } catch {
          return { raw: String(l || '') }
        }
      })
      .filter(Boolean)
    return NextResponse.json({ ok: true, source: 'redis', logs })
  }

  // File fallback
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf8')
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(-limit).reverse()
    const logs = lines.map((l) => {
      try { return JSON.parse(l) } catch { return { raw: l } }
    })
    return NextResponse.json({ ok: true, source: 'file', logs })
  } catch {
    return NextResponse.json({ ok: true, source: 'none', logs: [] })
  }
}


