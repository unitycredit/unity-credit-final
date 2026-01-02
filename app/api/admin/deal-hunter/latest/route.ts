import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readDealHunterLatest } from '@/lib/deal-hunter-store'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const db = await readDealHunterLatest()
  return NextResponse.json({ ok: true, db })
}


