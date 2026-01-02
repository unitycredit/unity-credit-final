import { NextResponse } from 'next/server'

function looksLikeSupabaseUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function looksLikeSupabaseKey(key: string) {
  // Supabase historically used JWT-style anon/service keys (commonly start with "eyJ").
  // Supabase now also supports "publishable" style keys (start with "sb_publishable_").
  if (typeof key !== 'string') return false
  if (key.startsWith('eyJ') && key.length > 100) return true
  if (key.startsWith('sb_publishable_') && key.length > 40) return true
  if (key.startsWith('sb_secret_') && key.length > 40) return true
  return false
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const info = {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(anonKey),
    supabaseUrlLooksValid: looksLikeSupabaseUrl(supabaseUrl),
    anonKeyLooksValid: looksLikeSupabaseKey(anonKey),
    supabaseHost: (() => {
      try {
        return new URL(supabaseUrl).host
      } catch {
        return null
      }
    })(),
  }

  if (!info.hasSupabaseUrl || !info.hasAnonKey) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'Missing env vars',
        ...info,
      },
      { status: 500 }
    )
  }

  // Verify Auth is reachable + key is accepted (does not require a user session)
  try {
    const healthUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/health`
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: 'no-store',
    })

    const text = await res.text().catch(() => '')

    return NextResponse.json(
      {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        ...info,
        // This is safe: it's just the health endpoint response (no secrets)
        authHealthResponse: text.slice(0, 500),
      },
      { status: res.ok ? 200 : 502 }
    )
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'Network error calling Supabase Auth health',
        ...info,
        error: e?.message || String(e),
      },
      { status: 502 }
    )
  }
}


