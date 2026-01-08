import { NextResponse, type NextRequest } from 'next/server'

// Hot-path perf: avoid per-request internal fetches.
// Middleware runs on every request; for scale we keep a short-lived in-memory cache.
let emergencyCtrlCache: { fetched_at: number; value: any } | null = null
const EMERGENCY_CTRL_TTL_MS = 30_000

/**
 * Enterprise middleware:
 * - Captures referral codes
 * - Protects authenticated routes via Supabase session cookies
 * - Keeps admin surfaces non-indexed
 * - Emergency global kill-switch (maintenance mode)
 *
 * Dev escape hatch:
 * - Set UNITYCREDIT_DEV_BYPASS_AUTH=true (development only)
 */
export async function middleware(_request: NextRequest) {
  const res = NextResponse.next()
  const url = _request.nextUrl

  const pathname = url.pathname || ''
  const host = String(_request.headers.get('host') || '').toLowerCase()
  const isLocalHost =
    host.startsWith('localhost:') ||
    host === 'localhost' ||
    host.startsWith('127.0.0.1:') ||
    host === '127.0.0.1'

  // Emergency Control: Global Site Access
  // - Admin routes always allowed
  // - Maintenance page + public emergency endpoint always allowed
  // - If disabled: HTML routes → rewrite to /maintenance, API routes → 503 JSON
  const isAdminSurface =
    pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/') || pathname.startsWith('/api/admin-center/')
  const isPublicEmergency = pathname.startsWith('/api/public/emergency-control')
  const isMaintenance = pathname === '/maintenance' || pathname.startsWith('/maintenance/')
  const isHealth = pathname.startsWith('/api/health/')

  if (!isAdminSurface && !isPublicEmergency && !isMaintenance && !isHealth) {
    try {
      const base = url.origin
      const now = Date.now()
      let ctrl: any = null
      if (emergencyCtrlCache && now - emergencyCtrlCache.fetched_at < EMERGENCY_CTRL_TTL_MS) {
        ctrl = emergencyCtrlCache.value
      } else {
        ctrl = await fetch(`${base}/api/public/emergency-control`, {
          // Allow edge/runtime caching; we also apply our own short TTL above.
          cache: 'force-cache',
        })
          .then((r) => r.json())
          .catch(() => null)
        emergencyCtrlCache = { fetched_at: now, value: ctrl }
      }
      const enabled = Boolean(ctrl?.switches?.global_site_access?.enabled ?? true)
      if (!enabled) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            {
              ok: false,
              maintenance: true,
              error: 'מיר האבן יעצט א קליינע טעכנישע פראבלעם, עס וועט צוריק ארבעטן אין די קומענדיגע פאר שעה',
            },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
          )
        }
        const m = url.clone()
        m.pathname = '/maintenance'
        m.search = ''
        return NextResponse.rewrite(m, { headers: { 'Cache-Control': 'no-store' } })
      }
    } catch {
      // If emergency-control is unreachable, fail open (do not take site down).
    }
  }

  // Referral capture: store ?ref=CODE for later signup attribution.
  const ref = url.searchParams.get('ref')
  if (ref) {
    const code = String(ref).trim()
    if (/^[A-Za-z0-9_-]{4,32}$/.test(code)) {
      res.cookies.set('uc_ref', code, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
  }

  // Hide admin surfaces from indexing/caching (auth is still disabled globally, but admin should stay private).
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    res.headers.set('Cache-Control', 'no-store, private')
  }

  // Route protection (Supabase session)
  const protect =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/premium' ||
    pathname.startsWith('/premium/')

  // DEV DEFAULT BYPASS (localhost only):
  // Keeps UI work unblocked locally by disabling ONLY the redirect-to-/login gate on protected pages.
  // Can be disabled via UNITYCREDIT_DEV_BYPASS_DEFAULT=false
  const localDevBypassDefault =
    process.env.NODE_ENV !== 'production' && isLocalHost && protect && process.env.UNITYCREDIT_DEV_BYPASS_DEFAULT !== 'false'
  if (localDevBypassDefault) {
    res.cookies.set('uc_dev_bypass', '1', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    })
    return res
  }

  // DEV / GUEST MODE:
  // Allow navigating protected pages without auth when:
  // - Running in non-production (default), OR
  // - Explicitly enabled via NEXT_PUBLIC_DEV_GUEST_MODE=true (even on deployed preview/prod).
  const guestDevEnabled =
    protect &&
    (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_GUEST_MODE === 'true')
  if (guestDevEnabled) return res

  // Edge-safe auth gate: cookie presence only (server-side routes/pages verify auth for real).
  const cookieNames = _request.cookies.getAll().map((c) => c.name)
  const hasSessionCookie =
    cookieNames.some((n) => n === 'sb-access-token' || n === 'sb-refresh-token') ||
    cookieNames.some((n) => n.startsWith('sb-') && n.endsWith('-auth-token'))

  const devBypass = process.env.UNITYCREDIT_DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production'
  const devTimedBypassEnabled = process.env.NODE_ENV !== 'production' && isLocalHost
  const bypassCookie = String(_request.cookies.get('uc_dev_bypass')?.value || '').trim()
  const wantsBypassCookie = devTimedBypassEnabled && url.searchParams.get('bypass') === '1'
  if (wantsBypassCookie) {
    // 1-hour local-only bypass for debugging login/session issues.
    // Visit: /dashboard?bypass=1 (dev only)
    res.cookies.set('uc_dev_bypass', '1', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    })
  }
  const timedBypass = devTimedBypassEnabled && (bypassCookie === '1' || wantsBypassCookie)
  const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // DEV OVERRIDE:
  // User requested direct entry without auth. Disable ONLY the redirect-to-/login gate in dev/local.
  // (Emergency controls/referral capture/admin noindex remain active.)
  if (protect && !devBypass && !timedBypass && hasSupabaseEnv) {
    if (!hasSessionCookie) {
      const login = new URL('/login', url)
      login.searchParams.set('next', pathname)
      return NextResponse.redirect(login)
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
