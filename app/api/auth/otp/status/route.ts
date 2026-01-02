import { NextResponse } from 'next/server'
import { resendConfig } from '@/lib/email-queue'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'

export const runtime = 'nodejs'

export async function GET() {
  const cfg = getSupabaseRuntimeConfig()
  const resend = resendConfig()
  return NextResponse.json(
    {
      ok: true,
      resend_configured: Boolean(resend.ok),
      supabase_service_role_configured: Boolean(cfg.serviceRoleKey),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


