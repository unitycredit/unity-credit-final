import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createHash } from 'node:crypto'

function computeCode(userId: string) {
  // Stable, short, URL-safe referral code (uppercase hex).
  return createHash('sha256').update(userId).digest('hex').slice(0, 10).toUpperCase()
}

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fallbackCode = computeCode(user.id)

  // Best-effort: persist referral_code on the user's profile row when schema supports it.
  try {
    const { data: row } = await supabase
      .from('users')
      .select('referral_code,referred_by')
      .eq('id', user.id)
      .maybeSingle()

    const existing = String((row as any)?.referral_code || '').trim()
    const code = existing || fallbackCode

    if (!existing) {
      await supabase.from('users').update({ referral_code: code }).eq('id', user.id)
    }

    return NextResponse.json({ ok: true, code, referred_by: (row as any)?.referred_by || null })
  } catch {
    return NextResponse.json({ ok: true, code: fallbackCode, referred_by: null })
  }
}


