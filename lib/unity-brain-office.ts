import 'server-only'

function safeTrim(v: any) {
  return String(v || '').trim()
}

export function unityBrainOfficeUrl(): string {
  // Default to the production Brain URL, but allow overrides via env.
  const defaultUrl = 'http://unitybrein-env.eba-3bzvyngj.us-east-2.elasticbeanstalk.com'
  const url = safeTrim(process.env.UNITY_BRAIN_OFFICE_URL || process.env.UNITY_BRAIN_URL || process.env.BRAIN_API_URL || defaultUrl)
  return url
}

export async function callUnityBrainOffice(params: { path: string; body: any; req?: Request }) {
  const baseUrl = unityBrainOfficeUrl()
  if (!baseUrl) {
    return {
      ok: false as const,
      status: 503,
      json: { ok: false, error: 'Unity Brain Office is not configured. Set UNITY_BRAIN_OFFICE_URL.' },
    }
  }
  const url = new URL(params.path, baseUrl)
  const host = params.req?.headers?.get?.('host') || ''
  const appId = safeTrim(process.env.UNITY_CREDIT_APP_ID || process.env.UNITY_APP_ID || 'Unity-Credit-Main')
  const appKey = safeTrim(process.env.UNITY_CREDIT_APP_KEY || '')

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(host ? { host } : {}),
        'x-app-id': appId,
        // Brain auth headers (compat across deployments).
        ...(appKey ? { 'App-Key': appKey, 'X-App-Key': appKey, 'X-Api-Key': appKey } : {}),
      },
      body: JSON.stringify(params.body || {}),
      cache: 'no-store',
    })
    const json = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, json }
  } catch (e: any) {
    return {
      ok: false as const,
      status: 502,
      json: { ok: false, error: e?.message || 'Unity Brain Office request failed' },
    }
  }
}


