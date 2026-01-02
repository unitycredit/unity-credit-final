import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { runPlaidRefresh } from '@/lib/plaid-refresh'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const out = await runPlaidRefresh()
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 500 })
  return NextResponse.json(out)
}


