import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { sanitizeInput } from '@/lib/security'

export const runtime = 'nodejs'

function cleanName(s: any) {
  return sanitizeInput(String(s || '')).trim().slice(0, 80)
}

function cleanPhone(s: any) {
  return sanitizeInput(String(s || ''))
    .trim()
    .replace(/[^\d+]/g, '')
    .slice(0, 32)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as any
  const first_name = cleanName(body?.first_name)
  const last_name = cleanName(body?.last_name)
  const phone = cleanPhone(body?.phone)

  // 1) Update auth user_metadata (always available for the logged-in user)
  const { error: authUpdErr } = await supabase.auth.updateUser({
    data: {
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone || null,
    } as any,
  })
  if (authUpdErr) {
    return NextResponse.json({ ok: false, error: authUpdErr.message }, { status: 400 })
  }

  // 2) Best-effort: keep public.users in sync for fast dashboard reads
  try {
    await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: String(user.email || '').trim().toLowerCase(),
          first_name: first_name || null,
          last_name: last_name || null,
          phone: phone || null,
        } as any,
        { onConflict: 'id' }
      )
  } catch {
    // ignore (RLS/schema may not be installed yet)
  }

  return NextResponse.json(
    {
      ok: true,
      profile: { first_name, last_name, phone },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}


