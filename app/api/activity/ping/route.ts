import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { recordUserPing, telemetryEnabled } from '@/lib/cluster-telemetry'

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  if (!telemetryEnabled()) return NextResponse.json({ ok: false, error: 'Telemetry not configured' }, { status: 503, headers: rl.headers })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  await recordUserPing(user.id)
  return NextResponse.json({ ok: true }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


