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
      const s = String(line || '').trim()
      if (!s || s.startsWith('#')) return
      const idx = s.indexOf('=')
      if (idx <= 0) return
      const key = s.slice(0, idx).trim()
      let value = s.slice(idx + 1)
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

function main() {
  const root = process.cwd()
  const envLocal = path.join(root, '.env.local')
  const envDot = path.join(root, '.env')
  if (exists(envLocal)) {
    // Best-effort validation (no secrets printed):
    // remind devs to configure AWS RDS / NextAuth when `.env.local` exists but is incomplete.
    try {
      let raw = read(envLocal)
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


