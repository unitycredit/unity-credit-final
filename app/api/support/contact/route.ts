import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/security'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const reqSchema = z.object({
  subject: z.string().nullable().optional(),
  message: z.string().min(3),
})

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const parsed = reqSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload', details: parsed.error.errors }, { status: 400, headers: rl.headers })
  }

  const subject = parsed.data.subject ? sanitizeInput(parsed.data.subject).trim().slice(0, 140) : null
  const message = sanitizeInput(parsed.data.message).trim().slice(0, 4000)
  if (!message) return NextResponse.json({ ok: false, error: 'Missing message' }, { status: 400, headers: rl.headers })

  // Forward to Brain Admin inbox (best-effort).
  let ticket_id: string | null = null
  let forwarded_ok = false
  let forwarded_status: number | null = null
  let forwarded_error: string | null = null
  try {
    const forwarded = await callUnityBrainOffice({
      path: '/admin/support-tickets',
      body: {
        type: 'SUPPORT_MESSAGE',
        user_id: user.id,
        email: user.email || null,
        subject,
        message,
        created_at: new Date().toISOString(),
      },
      req: req as any,
    })
    forwarded_ok = Boolean(forwarded.ok)
    forwarded_status = forwarded.status
    ticket_id = String((forwarded.json as any)?.ticket_id || '').trim() || null
    if (!forwarded.ok) forwarded_error = String((forwarded.json as any)?.error || 'Forward failed')
  } catch (e: any) {
    forwarded_ok = false
    forwarded_status = 503
    forwarded_error = e?.message || 'Brain unreachable'
  }

  // Local fallback store (so Support/Admin can still retrieve it even if Brain is offline).
  try {
    const admin = createAdminClient()
    if (admin) {
      const { error } = await admin.from('support_messages').insert({
        user_id: user.id,
        email: user.email || null,
        subject,
        message,
        forwarded_ok,
        forwarded_status,
        forwarded_error,
      } as any)
      if (error) console.error('Supabase error:', error)
    }
  } catch {
    // ignore
  }

  return NextResponse.json(
    { ok: true, ticket_id: ticket_id || undefined, forwarded_ok, forwarded_status },
    { status: 200, headers: { ...rl.headers, 'Cache-Control': 'no-store' } }
  )
}


