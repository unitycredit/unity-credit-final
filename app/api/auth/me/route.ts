import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, user: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: (user as any).email_confirmed_at || null,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ ok: false, user: null }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}


