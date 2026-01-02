import { NextRequest, NextResponse } from 'next/server'
import { runPlaidRefresh } from '@/lib/plaid-refresh'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  // Protected by a shared secret so you can safely call it from a scheduled task.
  const secret = process.env.PLAID_REFRESH_SECRET
  const provided = req.headers.get('x-refresh-secret') || req.nextUrl.searchParams.get('secret') || ''

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const out = await runPlaidRefresh()
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 500 })
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}


