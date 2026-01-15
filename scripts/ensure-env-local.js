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

function main() {
  const root = process.cwd()
  const envLocal = path.join(root, '.env.local')
  if (exists(envLocal)) {
    // Best-effort validation (no secrets printed):
    // remind devs to configure AWS RDS / NextAuth when `.env.local` exists but is incomplete.
    try {
      const raw = read(envLocal)
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


