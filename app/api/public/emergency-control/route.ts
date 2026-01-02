import { NextResponse } from 'next/server'
import { readEmergencyControl } from '@/lib/emergency-control'

export const runtime = 'nodejs'

export async function GET() {
  const state = await readEmergencyControl().catch(() => null)
  const switches = state?.switches || {
    global_site_access: { key: 'global_site_access', enabled: true, resume_at: null, reason: null, updated_at: null },
    advice_engine: { key: 'advice_engine', enabled: true, resume_at: null, reason: null, updated_at: null },
    email_dispatch: { key: 'email_dispatch', enabled: true, resume_at: null, reason: null, updated_at: null },
  }

  const res = NextResponse.json({ ok: true, switches, now: new Date().toISOString() })
  res.headers.set('Cache-Control', 'no-store')
  return res
}


