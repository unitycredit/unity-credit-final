import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createClient } from '@/lib/supabase'
import { readSavingsSubscribers, writeSavingsSubscribers } from '@/lib/savings-email-subscribers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })

  let userId = ''
  let email = ''
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = String(user?.id || '').trim()
    email = String(user?.email || '').trim()
  } catch {
    userId = ''
    email = ''
  }

  // Dev convenience: allow explicit email subscription when not authenticated.
  if (!userId || !email) {
    const body = (await req.json().catch(() => ({}))) as any
    const to = String(body?.to || '').trim()
    const uid = String(body?.user_id || '').trim()
    if (to && uid) {
      userId = uid
      email = to
    }
  }

  if (!userId || !email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })
  }

  const db = await readSavingsSubscribers()
  const prev = db.subscribers?.[userId]
  db.subscribers[userId] = {
    user_id: userId,
    email,
    subscribed_at: prev?.subscribed_at || new Date().toISOString(),
    last_sent_ym: prev?.last_sent_ym || null,
  }
  await writeSavingsSubscribers(db)

  return NextResponse.json({ ok: true }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


