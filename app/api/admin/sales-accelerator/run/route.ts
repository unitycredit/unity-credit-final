import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { runSalesAccelerator } from '@/lib/sales-accelerator'
import { writeSalesAcceleratorLatest } from '@/lib/sales-accelerator-store'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ ok: false, error: 'נישט ערלויבט' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as any
  const keywords = sanitizeInput(String(body?.keywords || 'b2b opportunities')).trim().slice(0, 120)
  const maxResultsPerQuery = Math.max(2, Math.min(8, Number(body?.maxResultsPerQuery || 5)))

  const result = await runSalesAccelerator({ keywords, maxResultsPerQuery })
  const saved = await writeSalesAcceleratorLatest(result).catch(() => null)

  return NextResponse.json({
    ok: true,
    result,
    stored: saved?.storage || 'unknown',
  })
}


