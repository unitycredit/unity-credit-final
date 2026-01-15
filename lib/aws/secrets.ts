import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

type CacheEntry = { fetchedAt: number; value: string }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

function region() {
  return String(process.env.AWS_REGION || process.env.SES_REGION || '').trim()
}

let _client: SecretsManagerClient | null = null
function client() {
  const r = region()
  if (!r) throw new Error('Missing AWS_REGION (required for Secrets Manager).')
  if (_client) return _client
  _client = new SecretsManagerClient({ region: r })
  return _client
}

/**
 * Fetch a secret string from AWS Secrets Manager.
 *
 * Recommended AWS-native deployment:
 * - App Runner injects Secrets Manager values as environment variables, so you don't need runtime fetches.
 * - This helper exists for controlled runtime fetching when you explicitly want it.
 */
export async function getSecretString(secretIdOrArn: string) {
  const id = String(secretIdOrArn || '').trim()
  if (!id) throw new Error('Missing secret id/arn.')

  const now = Date.now()
  const hit = cache.get(id)
  if (hit && now - hit.fetchedAt < TTL_MS) return hit.value

  const out = await client().send(new GetSecretValueCommand({ SecretId: id }))
  const v = String(out.SecretString || '').trim()
  if (!v) throw new Error('SecretString is empty.')
  cache.set(id, { fetchedAt: now, value: v })
  return v
}

export async function getJsonSecret<T = any>(secretIdOrArn: string): Promise<T> {
  const raw = await getSecretString(secretIdOrArn)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('SecretString is not valid JSON.')
  }
}

