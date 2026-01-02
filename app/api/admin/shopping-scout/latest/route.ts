import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

const KEY = 'uc:shop:scout:latest'
const FILE = path.join(process.cwd(), '.data', 'shopping_scout_latest.json')

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        return NextResponse.json({ ok: true, source: 'redis', ...parsed })
      } catch {
        // fall through
      }
    }
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return NextResponse.json({ ok: true, source: 'file', ...parsed })
  } catch {
    return NextResponse.json({ ok: false, error: 'No shopping scout snapshot yet.' }, { status: 404 })
  }
}


