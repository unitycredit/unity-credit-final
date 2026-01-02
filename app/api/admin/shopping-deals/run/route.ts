import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { scanShoppingDeals } from '@/lib/shopping-deals'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

const KEY = 'uc:shop:deals:latest'
const FILE = path.join(process.cwd(), '.data', 'shopping_deals_latest.json')

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as any
  const keywords = sanitizeInput(String(body?.keywords || 'walmart amazon deals')).trim()
  const maxPerQuery = Number(body?.maxPerQuery || 5)
  const sourcesRaw = Array.isArray(body?.sources) ? body.sources.map(String) : ['walmart', 'amazon']
  const sources = sourcesRaw.filter((s: string) => s === 'walmart' || s === 'amazon')

  const result = await scanShoppingDeals({ keywords, sources: sources as any, maxPerQuery })
  const payload = { ok: true, updated_at: new Date().toISOString(), result }

  if (upstashEnabled()) {
    await upstashCmd(['SETEX', KEY, 900, JSON.stringify(payload)]).catch(() => null) // 15m
  } else {
    const dir = path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(FILE, JSON.stringify(payload, null, 2), 'utf8')
  }

  return NextResponse.json(payload)
}


