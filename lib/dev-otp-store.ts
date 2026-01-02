import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomInt } from 'node:crypto'

type OtpRow = {
  email_hash: string
  purpose: string
  salt: string
  code_hash: string
  created_at: number
  expires_at: number
  attempts: number
}

type DevOtpDb = {
  v: 1
  rows: OtpRow[]
}

const FILE = path.join(process.cwd(), '.data', 'dev_otps.json')

function normalizePurpose(purpose: string) {
  const p = String(purpose || '').trim()
  return p || 'signup'
}

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function hashOtp(code: string, salt: string) {
  return sha256(`${salt}|${code}`)
}

function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

async function readDb(): Promise<DevOtpDb> {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.rows)) return parsed as DevOtpDb
  } catch {
    // ignore
  }
  return { v: 1, rows: [] }
}

async function writeDb(db: DevOtpDb) {
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), 'utf8')
}

export async function issueDevOtp(params: { email_hash: string; purpose: string; ttlSeconds: number }) {
  const purpose = normalizePurpose(params.purpose)
  const now = Date.now()
  const expires_at = now + Math.max(30, params.ttlSeconds) * 1000

  const code = makeCode()
  const salt = String(randomInt(100_000, 9_999_999))
  const code_hash = hashOtp(code, salt)

  const db = await readDb()
  const keep = db.rows.filter((r) => !(r.email_hash === params.email_hash && r.purpose === purpose))
  keep.push({
    email_hash: params.email_hash,
    purpose,
    salt,
    code_hash,
    created_at: now,
    expires_at,
    attempts: 0,
  })
  await writeDb({ v: 1, rows: keep })

  return { code }
}

export async function verifyDevOtp(params: { email_hash: string; purpose: string; code: string; maxAttempts: number }) {
  const purpose = normalizePurpose(params.purpose)
  const code = String(params.code || '').trim().replace(/\s+/g, '')
  const now = Date.now()

  const db = await readDb()
  const row = db.rows.find((r) => r.email_hash === params.email_hash && r.purpose === purpose) || null
  if (!row) return { ok: false as const, reason: 'missing' as const }

  // Expired
  if (row.expires_at <= now) {
    const next = db.rows.filter((r) => !(r.email_hash === params.email_hash && r.purpose === purpose))
    await writeDb({ v: 1, rows: next })
    return { ok: false as const, reason: 'expired' as const }
  }

  const attempts = Number(row.attempts || 0) + 1
  const max = Math.max(1, Number(params.maxAttempts || 1))

  const matches = hashOtp(code, row.salt) === row.code_hash

  if (!matches) {
    // Increment attempts; delete if too many.
    const nextRows = db.rows.map((r) => {
      if (r.email_hash === params.email_hash && r.purpose === purpose) return { ...r, attempts }
      return r
    })
    const finalRows = attempts >= max ? nextRows.filter((r) => !(r.email_hash === params.email_hash && r.purpose === purpose)) : nextRows
    await writeDb({ v: 1, rows: finalRows })
    return { ok: false as const, reason: 'invalid' as const }
  }

  // Success: consume OTP
  const remaining = db.rows.filter((r) => !(r.email_hash === params.email_hash && r.purpose === purpose))
  await writeDb({ v: 1, rows: remaining })
  return { ok: true as const }
}


