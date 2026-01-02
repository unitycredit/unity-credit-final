import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })

  const mem = process.memoryUsage()
  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
    node: process.version,
    platform: process.platform,
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    env: {
      plaid_env: String(process.env.PLAID_ENV || 'sandbox'),
      brain_url_configured: Boolean(process.env.UNITY_BRAIN_URL),
      brain_license_configured: Boolean(process.env.UNITY_BRAIN_LICENSE_KEY || process.env.UNITY_BRAIN_KEY),
      app_id: String(process.env.UNITY_APP_ID || 'UnityCredit-01'),
    },
  })
}


