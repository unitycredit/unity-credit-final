import 'server-only'
import { createHmac } from 'node:crypto'

type BrainExecuteResponse = {
  ok: boolean
  final?: string
  verified?: boolean
  verification?: any
  blocked?: boolean
  error?: string
  details?: any
}

function safeTrim(s: any) {
  return String(s || '').trim()
}

function hostFromReq(req?: Request) {
  if (!req) return ''
  const host = safeTrim((req as any).headers?.get?.('x-forwarded-host') || (req as any).headers?.get?.('host') || '')
  return host.toLowerCase()
}

export function brainConnectorConfig() {
  const baseUrl = safeTrim(process.env.BRAIN_API_URL || process.env.UNITY_BRAIN_URL || '')
  const licenseKey = safeTrim(process.env.MASTER_BRAIN_KEY || process.env.UNITY_BRAIN_LICENSE_KEY || process.env.UNITY_BRAIN_KEY || '')
  const appId = safeTrim(process.env.UNITY_APP_ID || 'UnityCredit-01')
  const appDomain = safeTrim(process.env.UNITY_APP_DOMAIN || '')
  return { baseUrl, licenseKey, appId, appDomain }
}

function hmacHex(key: string, message: string) {
  return createHmac('sha256', key).update(message).digest('hex')
}

function nowUnixSec() {
  return Math.floor(Date.now() / 1000)
}

export async function postToUnityBrain(params: {
  req?: Request
  path: string
  body: any
}) {
  const cfg = brainConnectorConfig()
  // Not an "internal server error": the service isn't configured.
  if (!cfg.baseUrl)
    return {
      ok: false as const,
      status: 503,
      error: 'Brain is not configured. Set BRAIN_API_URL (preferred) or UNITY_BRAIN_URL in .env.local and restart.',
    }
  if (!cfg.licenseKey)
    return {
      ok: false as const,
      status: 503,
      error:
        'Brain license is not configured. Set MASTER_BRAIN_KEY or UNITY_BRAIN_LICENSE_KEY (or UNITY_BRAIN_KEY) in .env.local and restart.',
    }

  // Security: require HTTPS in production for any external Brain endpoint.
  try {
    const u = new URL(cfg.baseUrl)
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
      return { ok: false as const, status: 503, error: 'UNITY_BRAIN_URL must use https in production.' }
    }
  } catch {
    return { ok: false as const, status: 503, error: 'UNITY_BRAIN_URL is invalid.' }
  }

  const app_domain = (cfg.appDomain || hostFromReq(params.req) || '').toLowerCase()
  if (!app_domain)
    return {
      ok: false as const,
      status: 503,
      error: 'Missing UNITY_APP_DOMAIN configuration (or send a Host header).',
    }

  const url = new URL(params.path, cfg.baseUrl)
  const bodyText = JSON.stringify(params.body || {})

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ts = String(nowUnixSec())
      // Signed request (integrity + replay protection over HTTPS)
      const sig = hmacHex(cfg.licenseKey, `${ts}.${bodyText}`)
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Required handshake headers:
          'x-unity-license-key': cfg.licenseKey,
          'x-app-id': cfg.appId,
          // Brain-side compatibility headers:
          'x-brain-master-token': cfg.licenseKey,
          'x-unity-app-domain': app_domain,
          'x-unity-ts': ts,
          'x-unity-signature': sig,
        },
        body: bodyText,
        cache: 'no-store',
      })

      // Retry transient upstream failures
      if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 250 : attempt === 2 ? 500 : 900))
          continue
        }
      }

      const json = (await resp.json().catch(() => ({}))) as BrainExecuteResponse
      return { ok: true as const, status: resp.status, json }
    } catch (e: any) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 250 : attempt === 2 ? 500 : 900))
        continue
      }
      return { ok: false as const, status: 503, error: e?.message || 'Brain unreachable' }
    }
  }

  return { ok: false as const, status: 503, error: 'Brain unreachable' }
}

export async function executeUnityBrain(params: {
  req?: Request
  domain: 'savings' | 'inventory' | 'travel'
  question: string
  system: string
  disclaimer_yi: string
  prefer_yiddish?: boolean
  require_all_nodes?: boolean
  category?: string
}) {
  return postToUnityBrain({
    req: params.req,
    path: '/v1/execute-intelligence',
    body: {
      domain: params.domain,
      category: params.category,
      question: params.question,
      system: params.system,
      disclaimer: params.disclaimer_yi,
      require_all_nodes: Boolean(params.require_all_nodes ?? true),
      prefer_yiddish: Boolean(params.prefer_yiddish ?? true),
    },
  })
}


