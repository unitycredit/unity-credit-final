import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type EncBlob = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string // base64
  tag: string // base64
  data: string // base64
  aad?: string // utf8 (optional associated data)
  key_mode?: 'strong' | 'legacy' // informational (helps audits)
}

type KeyInfo = { key: Buffer; mode: 'strong' | 'legacy'; source: 'UNITY_VAULT_ENC_KEY' | 'AUDIT_LOG_ENC_KEY' }

function parseKeyStrict32(raw: string): Buffer | null {
  const s = String(raw || '').trim()
  if (!s) return null
  // Base64 (expects 32 bytes -> often 44 chars with padding)
  try {
    const b = Buffer.from(s, 'base64')
    if (b.length === 32) return b
  } catch {
    // ignore
  }
  // Hex (64 hex chars -> 32 bytes)
  try {
    const b = Buffer.from(s, 'hex')
    if (b.length === 32) return b
  } catch {
    // ignore
  }
  return null
}

function deriveLegacyKey(raw: string): Buffer {
  // Back-compat with earlier deployments that provided a passphrase instead of a random 32-byte key.
  // NOTE: This is weaker than a random key; in production, prefer a 32-byte key in base64/hex.
  return createHash('sha256').update(String(raw || ''), 'utf8').digest()
}

function allowLegacyKeys() {
  // Default: allow in dev, require strong keys in production unless explicitly overridden.
  if (process.env.NODE_ENV !== 'production') return true
  return String(process.env.UNITY_VAULT_ALLOW_LEGACY_KEYS || '').trim() === '1'
}

function allowAuditKeyFallback() {
  return String(process.env.UNITY_VAULT_ALLOW_AUDIT_KEY_FALLBACK || '').trim() === '1'
}

function keyFromEnv(): KeyInfo | null {
  const primary = String(process.env.UNITY_VAULT_ENC_KEY || '').trim()
  const fallback = String(process.env.AUDIT_LOG_ENC_KEY || '').trim()

  if (primary) {
    const strict = parseKeyStrict32(primary)
    if (strict) return { key: strict, mode: 'strong', source: 'UNITY_VAULT_ENC_KEY' }
    return { key: deriveLegacyKey(primary), mode: 'legacy', source: 'UNITY_VAULT_ENC_KEY' }
  }

  if (fallback && allowAuditKeyFallback()) {
    const strict = parseKeyStrict32(fallback)
    if (strict) return { key: strict, mode: 'strong', source: 'AUDIT_LOG_ENC_KEY' }
    return { key: deriveLegacyKey(fallback), mode: 'legacy', source: 'AUDIT_LOG_ENC_KEY' }
  }

  return null
}

function requireUsableKey(): KeyInfo {
  const info = keyFromEnv()
  if (!info) throw new Error('UNITY_VAULT_ENC_KEY missing')
  if (info.mode === 'legacy' && !allowLegacyKeys()) {
    throw new Error('UNITY_VAULT_ENC_KEY must be a 32-byte random key (base64 or hex) in production.')
  }
  return info
}

function timingSafeStringEq(a: string, b: string) {
  const ha = createHash('sha256').update(String(a || ''), 'utf8').digest()
  const hb = createHash('sha256').update(String(b || ''), 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

function decodeB64(s: string) {
  return Buffer.from(String(s || ''), 'base64')
}

function assertIvTag(iv: Buffer, tag: Buffer) {
  // AES-GCM standard: 96-bit IV and 128-bit tag
  if (iv.length !== 12) throw new Error('Invalid IV length')
  if (tag.length !== 16) throw new Error('Invalid auth tag length')
}

export function vaultEncryptionEnabled() {
  try {
    requireUsableKey()
    return true
  } catch {
    return false
  }
}

export function encryptJson(payload: any, opts?: { aad?: string }): EncBlob {
  const info = requireUsableKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', info.key, iv)
  const aad = typeof opts?.aad === 'string' && opts.aad.trim() ? String(opts.aad) : null
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'))
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  assertIvTag(iv, tag)
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
    ...(aad ? { aad } : null),
    key_mode: info.mode === 'legacy' ? 'legacy' : 'strong',
  }
}

export function decryptJson(blob: EncBlob, opts?: { expectedAad?: string }): any {
  if (!blob || blob.v !== 1 || blob.alg !== 'aes-256-gcm') throw new Error('Unsupported vault blob')
  const info = requireUsableKey()
  const iv = decodeB64(blob.iv)
  const tag = decodeB64(blob.tag)
  const data = decodeB64(blob.data)
  assertIvTag(iv, tag)

  const aad = typeof blob.aad === 'string' && blob.aad.trim() ? String(blob.aad) : null
  const expected = typeof opts?.expectedAad === 'string' && opts.expectedAad.trim() ? String(opts.expectedAad) : null
  if (expected && !aad) throw new Error('Vault blob missing expected AAD')
  if (expected && aad && !timingSafeStringEq(expected, aad)) throw new Error('Vault blob AAD mismatch')

  const decipher = createDecipheriv('aes-256-gcm', info.key, iv)
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(dec)
}

export function encryptBytes(buf: Buffer, opts?: { aad?: string }): EncBlob {
  const info = requireUsableKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', info.key, iv)
  const aad = typeof opts?.aad === 'string' && opts.aad.trim() ? String(opts.aad) : null
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'))
  const enc = Buffer.concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()
  assertIvTag(iv, tag)
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
    ...(aad ? { aad } : null),
    key_mode: info.mode === 'legacy' ? 'legacy' : 'strong',
  }
}

export function decryptBytes(blob: EncBlob, opts?: { expectedAad?: string }): Buffer {
  if (!blob || blob.v !== 1 || blob.alg !== 'aes-256-gcm') throw new Error('Unsupported vault blob')
  const info = requireUsableKey()
  const iv = decodeB64(blob.iv)
  const tag = decodeB64(blob.tag)
  const data = decodeB64(blob.data)
  assertIvTag(iv, tag)

  const aad = typeof blob.aad === 'string' && blob.aad.trim() ? String(blob.aad) : null
  const expected = typeof opts?.expectedAad === 'string' && opts.expectedAad.trim() ? String(opts.expectedAad) : null
  if (expected && !aad) throw new Error('Vault blob missing expected AAD')
  if (expected && aad && !timingSafeStringEq(expected, aad)) throw new Error('Vault blob AAD mismatch')

  const decipher = createDecipheriv('aes-256-gcm', info.key, iv)
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}


