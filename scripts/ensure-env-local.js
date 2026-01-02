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
  if (exists(envLocal)) return

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


