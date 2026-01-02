import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase-admin'

export type StoredPlaidItem = {
  user_id?: string | null
  item_id: string
  access_token: string
  updated_at: string
}

type EncPayload = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string // base64
  tag: string // base64
  data: string // base64
}

function keyFromEnv(): Buffer | null {
  const raw = String(process.env.PLAID_TOKEN_ENC_KEY || process.env.AUDIT_LOG_ENC_KEY || '').trim()
  if (!raw) return null
  // Allow base64/hex/raw passphrase; always derive 32 bytes via sha256
  try {
    const b64 = Buffer.from(raw, 'base64')
    if (b64.length >= 32) return b64.subarray(0, 32)
  } catch {
    // ignore
  }
  try {
    const hex = Buffer.from(raw, 'hex')
    if (hex.length >= 32) return hex.subarray(0, 32)
  } catch {
    // ignore
  }
  return createHash('sha256').update(raw).digest()
}

function hasEncryptionKey() {
  return Boolean(keyFromEnv())
}

function assertIvTag(iv: Buffer, tag: Buffer) {
  if (iv.length !== 12) throw new Error('Invalid IV length')
  if (tag.length !== 16) throw new Error('Invalid auth tag length')
}

function encryptToken(accessToken: string): string {
  const key = keyFromEnv()
  if (!key) return accessToken
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(Buffer.from(accessToken, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  assertIvTag(iv, tag)
  const payload: EncPayload = {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  }
  return JSON.stringify(payload)
}

function decryptToken(maybeEnc: string): string {
  const raw = String(maybeEnc || '')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as EncPayload
    if (parsed?.v !== 1 || parsed?.alg !== 'aes-256-gcm' || !parsed.iv || !parsed.tag || !parsed.data) return raw
    const key = keyFromEnv()
    if (!key) return ''
    const iv = Buffer.from(parsed.iv, 'base64')
    const tag = Buffer.from(parsed.tag, 'base64')
    const data = Buffer.from(parsed.data, 'base64')
    assertIvTag(iv, tag)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return raw
  }
}

async function readTokensFromFile(): Promise<StoredPlaidItem[]> {
  const filePath = path.join(process.cwd(), '.data', 'plaid_tokens.json')
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredPlaidItem[]) : []
  } catch {
    return []
  }
}

async function writeTokenToFile(item_id: string, access_token: string) {
  const dataDir = path.join(process.cwd(), '.data')
  const filePath = path.join(dataDir, 'plaid_tokens.json')
  await fs.mkdir(dataDir, { recursive: true })

  let existing: StoredPlaidItem[] = []
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) existing = parsed
  } catch {
    // ignore
  }

  const now = new Date().toISOString()
  const next = existing.filter((x) => x && x.item_id !== item_id)
  next.push({ item_id, access_token, updated_at: now })
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8')
}

export async function readStoredPlaidTokens(params?: { user_id?: string | null }): Promise<StoredPlaidItem[]> {
  const userId = params?.user_id ? String(params.user_id).trim() : null
  const admin = createAdminClient()
  const isProd = process.env.NODE_ENV === 'production'
  // If a user_id filter is requested, we require the Supabase admin client so tokens remain tenant-safe.
  if (!admin) {
    if (isProd) return []
    return userId ? [] : await readTokensFromFile()
  }

  let q = admin.from('plaid_tokens').select('user_id,item_id,access_token_enc,updated_at')
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q.order('updated_at', { ascending: false })
  if (error) {
    // Best-effort fallback in dev only. In production, fail closed (never read plaintext files).
    if (!isProd) return await readTokensFromFile()
    return []
  }
  const rows = Array.isArray(data) ? (data as any[]) : []
  return rows
    .map((r) => ({
      user_id: (r as any)?.user_id ? String((r as any).user_id) : null,
      item_id: String(r.item_id || ''),
      access_token: decryptToken(String(r.access_token_enc || '')),
      updated_at: String(r.updated_at || ''),
    }))
    .filter((r) => r.item_id && r.access_token)
}

export async function storePlaidToken(params: { user_id?: string | null; item_id: string; access_token: string }) {
  const item_id = String(params.item_id || '').trim()
  const access_token = String(params.access_token || '').trim()
  if (!item_id || !access_token) return { ok: false as const, error: 'Missing item_id/access_token' }

  const admin = createAdminClient()
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && !hasEncryptionKey()) {
    return {
      ok: false as const,
      error: 'PLAID_TOKEN_ENC_KEY is required in production to encrypt Plaid access tokens at rest.',
    }
  }
  if (!admin) {
    // Dev fallback (no service role)
    if (isProd) return { ok: false as const, error: 'Supabase admin key missing. Cannot store Plaid access tokens in production.' }
    await writeTokenToFile(item_id, access_token)
    return { ok: true as const, storage: 'file' as const }
  }

  const now = new Date().toISOString()
  const access_token_enc = encryptToken(access_token)
  const payload = { item_id, user_id: params.user_id || null, access_token_enc, updated_at: now }
  const { error } = await admin.from('plaid_tokens').upsert(payload, { onConflict: 'item_id' })
  if (error) {
    // If the token table isn't installed yet, keep dev/sandbox usable by falling back to local file storage.
    if (!isProd) {
      await writeTokenToFile(item_id, access_token)
      return { ok: true as const, storage: 'file' as const }
    }
    return { ok: false as const, error: 'Plaid token store is not configured. Run the Supabase migration.' }
  }
  return { ok: true as const, storage: 'supabase' as const }
}


