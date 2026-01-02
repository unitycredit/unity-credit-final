import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readSalesAcceleratorLatest } from '@/lib/sales-accelerator-store'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ ok: false, error: 'נישט ערלויבט' }, { status: 401 })
  const result = await readSalesAcceleratorLatest().catch(() => null)
  return NextResponse.json({ ok: true, result: result || null }, { headers: { 'Cache-Control': 'no-store' } })
}


