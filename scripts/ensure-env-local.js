/* eslint-disable no-console */
/**
 * Ensures `.env.local` exists for local dev.
 *
 * Behavior:
 * - If `.env.local` already exists, do nothing.
 * - Otherwise, copy `DOTENV_LOCAL_TEMPLATE.txt` → `.env.local` (preferred),
 *   else `env.example` → `.env.local` (fallback).
 *
 * This is intentionally best-effort: it does not validate values.
 */

const fs = require('node:fs')
const path = require('node:path')

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

function write(p, content) {
  fs.writeFileSync(p, content, 'utf8')
}

function parseEnv(raw) {
  const out = {}
  String(raw || '')
    .split(/\r?\n/g)
    .forEach((line) => {
      let s = String(line || '').trim()
      if (!s || s.startsWith('#')) return

      // Strip BOM / zero-width chars that can break dotenv parsing.
      // (These can appear when copying secrets from rich text / chat apps.)
      s = s.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, '')

      // Support common shells:
      // - export KEY=VALUE
      // - set KEY=VALUE
      // Also support KEY: VALUE (common mistake when copying).
      if (s.startsWith('export ')) s = s.slice('export '.length).trim()
      if (s.startsWith('set ')) s = s.slice('set '.length).trim()

      let idx = s.indexOf('=')
      let sep = '='
      if (idx <= 0) {
        idx = s.indexOf(':')
        sep = ':'
      }
      if (idx <= 0) return

      const key = s.slice(0, idx).trim()
      let value = s.slice(idx + 1)
      if (sep === ':') value = value.trimStart()
      // Remove surrounding quotes (best-effort).
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      out[key] = value
    })
  return out
}

function isPlaceholderValue(v) {
  const s = String(v || '')
  return (
    !s ||
    s.includes('YOUR_PASSWORD') ||
    s.includes('PASTE_') ||
    s.includes('replace-') ||
    s.includes('change-me') ||
    s.includes('pk_test_') ||
    s.includes('sk_test_')
  )
}

function firstNonPlaceholder(map, keys) {
  for (const k of keys) {
    const v = map[k]
    if (v && !isPlaceholderValue(v)) return v
  }
  return ''
}

function stripQuotes(v) {
  let s = String(v || '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1)
  return s
}

function extractAssignedValue(raw, key) {
  // Best-effort: find `KEY=...` anywhere in the file and capture until end-of-line.
  // This works even if the line has invisible prefixes that prevent clean `^KEY=` matches.
  const re = new RegExp(`${key}\\s*=\\s*([^\\r\\n#]+)`, 'm')
  const m = String(raw || '').match(re)
  if (!m) return ''
  return stripQuotes(String(m[1] || '').trim())
}

function normalizeEnvLocal(raw) {
  const map = parseEnv(raw)
  const lines = []
  const hasBom = raw.charCodeAt(0) === 0xfeff || raw.includes('\uFEFF')
  const hasZeroWidth = /[\u200B\u200C\u200D\u2060]/.test(raw)
  const hasCleanDbUrl = /(^|\n)\s*DATABASE_URL\s*=/.test(raw)
  const mentionsDbUrl = /DATABASE_URL\s*=/.test(raw)
  const forceEmit = hasBom || hasZeroWidth || (mentionsDbUrl && !hasCleanDbUrl)

  // If someone used Postgres/pg standard env names, map them to our app's expected keys.
  const candidates = {
    DATABASE_URL: ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRESQL_URL', 'PG_CONNECTION_STRING', 'PGURL'],
    DB_HOST: ['DB_HOST', 'PGHOST', 'POSTGRES_HOST', 'POSTGRESQL_HOST', 'RDS_HOST', 'AWS_RDS_HOST'],
    DB_PORT: ['DB_PORT', 'PGPORT', 'POSTGRES_PORT', 'POSTGRESQL_PORT', 'RDS_PORT', 'AWS_RDS_PORT'],
    DB_USER: ['DB_USER', 'PGUSER', 'POSTGRES_USER', 'POSTGRES_USERNAME', 'RDS_USER', 'AWS_RDS_USER', 'DB_USERNAME', 'DATABASE_USER'],
    DB_PASSWORD: ['DB_PASSWORD', 'PGPASSWORD', 'POSTGRES_PASSWORD', 'RDS_PASSWORD', 'AWS_RDS_PASSWORD', 'DB_PASS', 'DATABASE_PASSWORD'],
    DB_NAME: ['DB_NAME', 'PGDATABASE', 'POSTGRES_DB', 'POSTGRES_DATABASE', 'RDS_DB', 'AWS_RDS_DB', 'DATABASE_NAME'],
  }

  for (const targetKey of Object.keys(candidates)) {
    const hasTarget = Object.prototype.hasOwnProperty.call(map, targetKey)
    const targetVal = hasTarget ? map[targetKey] : ''
    // If the file contains BOM/zero-width chars, we force re-emitting keys so the last occurrence is clean.
    if (!forceEmit && hasTarget && !isPlaceholderValue(targetVal)) continue

    let v = firstNonPlaceholder(map, candidates[targetKey])
    // Fallback: if we couldn't parse the key cleanly, extract via regex.
    if (!v && targetKey === 'DATABASE_URL') {
      v = extractAssignedValue(raw, 'DATABASE_URL')
    }
    if (!v) continue

    lines.push(`${targetKey}=${v}`)
  }

  if (!lines.length) return { raw, normalizedCount: 0 }

  const next =
    raw.replace(/\s+$/g, '') +
    `\n\n# Normalized keys by scripts/ensure-env-local.js (${new Date().toISOString()})\n` +
    lines.join('\n') +
    '\n'
  return { raw: next, normalizedCount: lines.length }
}

function main() {
  const root = process.cwd()
  const envLocal = path.join(root, '.env.local')
  const envDot = path.join(root, '.env')
  if (exists(envLocal)) {
    // Best-effort validation (no secrets printed):
    // remind devs to configure AWS RDS / NextAuth when `.env.local` exists but is incomplete.
    try {
      let raw = read(envLocal)

      // Repair common .env.local key mistakes (no secrets printed).
      try {
        const norm = normalizeEnvLocal(raw)
        if (norm.normalizedCount) {
          raw = norm.raw
          write(envLocal, raw)
          console.log(`[env] Normalized ${norm.normalizedCount} keys inside .env.local.`)
        }
      } catch {
        // ignore normalize failures
      }
      // If a developer put real creds in `.env` (common), `.env.local` takes precedence in Next.js
      // and can accidentally override those values with placeholders. We sync missing keys from `.env`
      // into `.env.local` (local-only file) without printing secrets.
      try {
        if (exists(envDot)) {
          const localMap = parseEnv(raw)
          const dotMap = parseEnv(read(envDot))
          const keysToSync = [
            // DB (RDS)
            'DATABASE_URL',
            'DB_HOST',
            'DB_PORT',
            'DB_USER',
            'DB_PASSWORD',
            'DB_NAME',
            'PGSSLMODE',
            'DB_SSL',
            // NextAuth
            'NEXTAUTH_SECRET',
            'NEXTAUTH_URL',
            // Cognito (IDs are safe; credentials still should not be committed)
            'AWS_REGION',
            'AWS_COGNITO_REGION',
            'AWS_COGNITO_USER_POOL_ID',
            'AWS_COGNITO_APP_CLIENT_ID',
            // boto3 credentials (dev only; prefer IAM roles in prod)
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_SESSION_TOKEN',
          ]

          const lines = []
          for (const k of keysToSync) {
            const hasLocal = Object.prototype.hasOwnProperty.call(localMap, k)
            const localVal = hasLocal ? localMap[k] : ''
            const dotVal = dotMap[k]
            if (!dotVal) continue
            // Sync if missing or placeholder.
            if (!hasLocal || isPlaceholderValue(localVal)) {
              lines.push(`${k}=${dotVal}`)
            }
          }

          if (lines.length) {
            raw =
              raw.replace(/\s+$/g, '') +
              `\n\n# Synced from .env by scripts/ensure-env-local.js (${new Date().toISOString()})\n` +
              lines.join('\n') +
              '\n'
            write(envLocal, raw)
            console.log(`[env] Synced ${lines.length} keys from .env -> .env.local (local-only).`)
          }
        }
      } catch {
        // ignore sync failures
      }

      const hasDbUrl = /(^|\n)\s*DATABASE_URL\s*=/.test(raw)
      const hasDbPieces = /(^|\n)\s*DB_HOST\s*=/.test(raw) && /(^|\n)\s*DB_PASSWORD\s*=/.test(raw)
      const looksPlaceholder =
        /YOUR_PASSWORD/.test(raw) ||
        /DB_PASSWORD\s*=\s*(?:YOUR_PASSWORD|change-me|replace-)/.test(raw) ||
        /DATABASE_URL\s*=.*YOUR_PASSWORD/.test(raw)
      if (!hasDbUrl && !hasDbPieces) {
        console.warn(
          [
            '[env] Missing AWS RDS config in .env.local.',
            '      Add DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.',
            '      Expected endpoint: unity-credit-db.cluster-c3yemoqwimik.us-east-2.rds.amazonaws.com',
          ].join('\n')
        )
      } else if (looksPlaceholder) {
        console.warn(
          [
            '[env] AWS RDS variables appear to be placeholders in .env.local.',
            '      Replace YOUR_PASSWORD / change-me values with real credentials before running auth.',
          ].join('\n')
        )
      }
      if (!/(^|\n)\s*NEXTAUTH_SECRET\s*=/.test(raw)) {
        console.warn('[env] Missing NEXTAUTH_SECRET in .env.local (required for stable login sessions in production).')
      }
      const hasSesRegion = /(^|\n)\s*(SES_REGION|AWS_REGION)\s*=/.test(raw)
      const hasSesFrom = /(^|\n)\s*SES_FROM_EMAIL\s*=/.test(raw)
      if (!hasSesRegion || !hasSesFrom) {
        console.warn('[env] Missing SES config in .env.local (SES_REGION/AWS_REGION + SES_FROM_EMAIL) for OTP emails.')
      }
    } catch {
      // ignore
    }
    return
  }

  const template = path.join(root, 'DOTENV_LOCAL_TEMPLATE.txt')
  const example = path.join(root, 'env.example')
  const src = exists(template) ? template : exists(example) ? example : null

  if (!src) {
    console.warn('[env] No template found (DOTENV_LOCAL_TEMPLATE.txt or env.example). Create .env.local manually.')
    return
  }

  const content = read(src)
  write(envLocal, content)
  console.log(`[env] Created .env.local from ${path.basename(src)}. Fill in real credentials and restart if needed.`)
}

main()


