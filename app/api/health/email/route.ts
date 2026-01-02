import { NextResponse } from 'next/server'
import { resendConfig } from '@/lib/email-queue'
import { upstashEnabled } from '@/lib/upstash'

export const runtime = 'nodejs'

export async function GET() {
  const resend = resendConfig()
  const upstash = upstashEnabled()

  return NextResponse.json(
    {
      ok: Boolean(resend.ok),
      resend_configured: Boolean(resend.ok),
      queue_mode: upstash ? 'upstash' : 'direct',
      notes: upstash
        ? [
            'Emails are queued in Upstash. Ensure the email worker is running (scripts/email-worker.js) or queued emails will not be delivered.',
          ]
        : ['Emails are sent directly to Resend from the API route (no worker required).'],
    },
    { status: resend.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } }
  )
}


