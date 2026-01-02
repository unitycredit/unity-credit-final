type UpstashResp<T = any> = { result?: T; error?: string }

function cfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || ''
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || ''
  return { url: url.replace(/\/$/, ''), token }
}

export function upstashEnabled() {
  const { url, token } = cfg()
  return Boolean(url && token)
}

export async function upstashCmd<T = any>(command: any[]): Promise<UpstashResp<T>> {
  const { url, token } = cfg()
  if (!url || !token) return { error: 'Upstash not configured' }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  const json = (await resp.json().catch(() => ({}))) as UpstashResp<T>
  if (!resp.ok) return { error: json?.error || `HTTP ${resp.status}` }
  return json
}

export async function upstashPipeline<T = any>(commands: any[][]): Promise<UpstashResp<T>> {
  const { url, token } = cfg()
  if (!url || !token) return { error: 'Upstash not configured' }
  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  const json = (await resp.json().catch(() => ({}))) as UpstashResp<T>
  if (!resp.ok) return { error: json?.error || `HTTP ${resp.status}` }
  return json
}


