import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { MARKET_MODE_COOKIE, normalizeMarketMode, type MarketMode } from '@/lib/market-mode'

function cookieOptions(req: NextRequest) {
  const isSecure = (() => {
    try {
      return new URL(req.url).protocol === 'https:'
    } catch {
      return false
    }
  })()
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure,
    path: '/',
    maxAge: 60 * 60 * 24 * 365 * 5, // 5y
  }
}

async function readMarketModeFromProfile(): Promise<MarketMode | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return null

    const { data, error } = await supabase.from('users').select('market_mode').eq('id', user.id).maybeSingle()
    if (error) return null // schema may not be migrated yet
    const mm = normalizeMarketMode((data as any)?.market_mode)
    return mm || null
  } catch {
    return null
  }
}

async function writeMarketModeToProfile(mode: MarketMode) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return

    // Best-effort: schema may not include the column yet.
    await supabase.from('users').update({ market_mode: mode } as any).eq('id', user.id)
  } catch {
    // ignore
  }
}

export async function GET(req: NextRequest) {
  const cookieRaw = req.cookies.get(MARKET_MODE_COOKIE)?.value
  const fromCookie = cookieRaw ? normalizeMarketMode(cookieRaw) : null
  const fromProfile = await readMarketModeFromProfile()
  const market_mode = fromProfile || fromCookie || normalizeMarketMode('')

  const res = NextResponse.json({ ok: true, market_mode, source: fromProfile ? 'profile' : fromCookie ? 'cookie' : 'default' })
  res.cookies.set(MARKET_MODE_COOKIE, market_mode, cookieOptions(req))
  return res
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any
  const market_mode = normalizeMarketMode(body?.market_mode)

  // Persist server-side when possible, but never block the user toggle on DB schema/auth.
  await writeMarketModeToProfile(market_mode)

  const res = NextResponse.json({ ok: true, market_mode })
  res.cookies.set(MARKET_MODE_COOKIE, market_mode, cookieOptions(req))
  return res
}


