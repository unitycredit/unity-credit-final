import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  // Live search is disabled in this deployment.
  // Catalog generation should be performed inside the standalone Brain service.
  return NextResponse.json({ error: 'Catalog generation is unavailable in this deployment.' }, { status: 400 })
}


