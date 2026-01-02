import { NextResponse } from 'next/server'
import { readAdminSettings } from '@/lib/admin-settings'
import { auditEncryptionEnabled } from '@/lib/audit-trail'
import { upstashEnabled } from '@/lib/upstash'
import { brainConnectorConfig } from '@/services/brainConnector'

export async function GET() {
  const settings = await readAdminSettings().catch(() => null)
  const cfg = brainConnectorConfig()

  // Best-effort upstream reachability check (does not leak secrets).
  let brain_reachable: boolean | null = null
  let brain_ping_error: string | null = null
  if (cfg.baseUrl) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 1500)
      // Many deployments expose /health or /v1/health; try both quickly.
      const urls = [new URL('/health', cfg.baseUrl), new URL('/v1/health', cfg.baseUrl)]
      let ok = false
      for (const u of urls) {
        const r = await fetch(u, { method: 'GET', cache: 'no-store', signal: ctrl.signal }).catch(() => null)
        if (r && (r.status === 200 || r.status === 204)) {
          ok = true
          break
        }
      }
      clearTimeout(t)
      brain_reachable = ok
      if (!ok) brain_ping_error = 'No health endpoint responded (expected 200/204).'
    } catch (e: any) {
      brain_reachable = false
      brain_ping_error = String(e?.name === 'AbortError' ? 'timeout' : e?.message || 'unreachable').slice(0, 120)
    }
  }

  const info = {
    require_all: typeof settings?.require_all_nodes === 'boolean' ? settings.require_all_nodes : true,
    brain: {
      url_configured: Boolean(cfg.baseUrl),
      license_configured: Boolean(cfg.licenseKey),
      reachable: brain_reachable,
      ping_error: brain_ping_error,
      app_id: String(cfg.appId || 'UnityCredit-01'),
    },
    audit: {
      encrypted_at_rest: auditEncryptionEnabled(),
      upstash_storage: upstashEnabled(),
    },
  }

  const ok = info.brain.url_configured && info.brain.license_configured

  const res = NextResponse.json(
    {
      ok,
      info,
      now: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
  res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60')
  return res
}


