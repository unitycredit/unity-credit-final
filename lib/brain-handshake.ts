import 'server-only'

import crypto from 'node:crypto'

function safeTrim(v: any) {
  return String(v || '').trim()
}

export function unityCreditAppId() {
  return safeTrim(process.env.UNITY_CREDIT_APP_ID || process.env.UNITY_APP_ID || 'Unity-Credit-Main')
}

export function unityCreditAppKey() {
  return safeTrim(process.env.UNITY_CREDIT_APP_KEY || '')
}

export function unityBrainBaseUrl() {
  // Default to the production Brain URL, but allow overrides via env.
  const defaultUrl = 'http://unitybrein-env.eba-3bzvyngj.us-east-2.elasticbeanstalk.com'
  const url = safeTrim(process.env.UNITY_BRAIN_OFFICE_URL || process.env.UNITY_BRAIN_URL || process.env.BRAIN_API_URL || defaultUrl)
  return url
}

export function generateSecurityKey(params: { appId: string; appKey: string }) {
  const ts = String(Math.floor(Date.now() / 1000))
  const nonce = crypto.randomBytes(16).toString('hex')
  const message = `${params.appId}.${ts}.${nonce}`
  const sig = crypto.createHmac('sha256', params.appKey).update(message).digest('hex')
  return { ts, nonce, sig, message }
}

export async function authenticateWithBrain() {
  const appId = unityCreditAppId()
  const appKey = unityCreditAppKey()
  const baseUrl = unityBrainBaseUrl()

  if (!appKey) {
    return { ok: false as const, status: 500, state: 'error' as const, error: 'UNITY_CREDIT_APP_KEY is not configured.' }
  }

  const url = new URL('/v1/authenticate', baseUrl)
  const sk = generateSecurityKey({ appId, appKey })

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-id': appId,
      // Keep App-Key headers present for compatibility with Brain deployments that also validate app keys here.
      ...(appKey ? { 'App-Key': appKey, 'X-App-Key': appKey, 'X-Api-Key': appKey } : {}),
      'x-security-key': sk.sig,
      'x-security-ts': sk.ts,
      'x-security-nonce': sk.nonce,
    },
    body: JSON.stringify({ app_id: appId }),
    cache: 'no-store',
  })

  const json = await resp.json().catch(() => ({}))

  if (resp.status === 200) {
    return { ok: true as const, status: 200, state: 'active' as const, json }
  }
  if (resp.status === 403) {
    return { ok: false as const, status: 403, state: 'pending' as const, json }
  }

  return { ok: false as const, status: resp.status, state: 'error' as const, json, error: String((json as any)?.error || 'Handshake failed') }
}


