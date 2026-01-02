import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled, upstashPipeline } from '@/lib/upstash'

type EncLine = {
  v: 1
  alg: 'aes-256-gcm'
  iv: string // base64
  tag: string // base64
  data: string // base64
}

const VERIFICATION_AUDIT_KEY = 'uc:audit:verification_nodes'
const VERIFICATION_AUDIT_FILE = path.join(process.cwd(), '.data', 'verification_audit.enc.jsonl')

function keyFromEnv(): Buffer | null {
  const raw = (process.env.AUDIT_LOG_ENC_KEY || '').trim()
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

function assertIvTag(iv: Buffer, tag: Buffer) {
  if (iv.length !== 12) throw new Error('Invalid IV length')
  if (tag.length !== 16) throw new Error('Invalid auth tag length')
}

export function auditEncryptionEnabled() {
  return Boolean(keyFromEnv())
}

export function encryptAuditEntry(entry: any): EncLine {
  const key = keyFromEnv()
  if (!key) throw new Error('AUDIT_LOG_ENC_KEY missing')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(entry), 'utf8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  assertIvTag(iv, tag)
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  }
}

export function decryptAuditEntry(line: EncLine): any {
  const key = keyFromEnv()
  if (!key) throw new Error('AUDIT_LOG_ENC_KEY missing')
  const iv = Buffer.from(line.iv, 'base64')
  const tag = Buffer.from(line.tag, 'base64')
  const data = Buffer.from(line.data, 'base64')
  assertIvTag(iv, tag)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  return JSON.parse(dec)
}

export async function appendVerificationAudit(entry: any) {
  const key = keyFromEnv()
  const logged = { ...entry, logged_at: new Date().toISOString() }

  // If encryption key is missing, fall back to plain file
  if (!key) {
    try {
      const dir = path.join(process.cwd(), '.data')
      await fs.mkdir(dir, { recursive: true })
      const file = path.join(dir, 'verification_audit.jsonl')
      await fs.appendFile(file, JSON.stringify(logged) + '\n', 'utf8')
    } catch {
      // ignore
    }
    return { ok: true as const, storage: 'plain-file' as const }
  }

  const enc = encryptAuditEntry(logged)
  const line = JSON.stringify(enc)

  if (upstashEnabled()) {
    // Keep last ~10k entries
    await upstashPipeline([
      ['LPUSH', VERIFICATION_AUDIT_KEY, line],
      ['LTRIM', VERIFICATION_AUDIT_KEY, 0, 9999],
    ]).catch(() => null)
    return { ok: true as const, storage: 'upstash' as const }
  }

  try {
    const dir = path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(VERIFICATION_AUDIT_FILE, line + '\n', 'utf8')
    return { ok: true as const, storage: 'enc-file' as const }
  } catch {
    return { ok: false as const, storage: 'enc-file' as const }
  }
}

export async function readVerificationAudit(limit = 500) {
  const key = keyFromEnv()

  if (upstashEnabled()) {
    const resp = await upstashCmd<string[]>(['LRANGE', VERIFICATION_AUDIT_KEY, 0, Math.max(0, limit - 1)])
    const raw = Array.isArray(resp?.result) ? resp.result : []
    const logs = raw
      .map((l) => {
        try {
          const parsed = JSON.parse(String(l || ''))
          if (parsed?.v === 1 && parsed?.alg === 'aes-256-gcm' && key) return decryptAuditEntry(parsed as EncLine)
          return parsed
        } catch {
          return { raw: String(l || '') }
        }
      })
      .filter(Boolean)
    return { ok: true as const, storage: 'upstash' as const, encrypted: Boolean(key), logs }
  }

  // Prefer encrypted file if it exists
  try {
    const raw = await fs.readFile(VERIFICATION_AUDIT_FILE, 'utf8')
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-limit)
    const logs = lines.map((l) => {
      try {
        const parsed = JSON.parse(l)
        if (parsed?.v === 1 && parsed?.alg === 'aes-256-gcm' && key) return decryptAuditEntry(parsed as EncLine)
        return parsed
      } catch {
        return { raw: l }
      }
    })
    return { ok: true as const, storage: 'enc-file' as const, encrypted: Boolean(key), logs }
  } catch {
    // fall back
  }

  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'verification_audit.jsonl'), 'utf8')
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean).slice(-limit)
    const logs = lines.map((l) => {
      try { return JSON.parse(l) } catch { return { raw: l } }
    })
    return { ok: true as const, storage: 'plain-file' as const, encrypted: false, logs }
  } catch {
    return { ok: true as const, storage: 'none' as const, encrypted: false, logs: [] as any[] }
  }
}


