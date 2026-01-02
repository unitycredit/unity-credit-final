/* eslint-disable no-console */
/**
 * Hard reset for local dev caches (Windows-safe).
 *
 * Clears:
 * - .next/ (Next build cache)
 * - node_modules/ (dependencies)
 *
 * Usage:
 *   npm run reset:dev
 *
 * Then:
 *   npm install
 *   npm run dev
 */

const fs = require('node:fs')
const path = require('node:path')

function rm(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true })
    console.log(`[reset] removed ${p}`)
  } catch (e) {
    console.warn(`[reset] failed to remove ${p}:`, e && e.message ? e.message : String(e))
  }
}

function main() {
  const cwd = process.cwd()
  rm(path.join(cwd, '.next'))
  rm(path.join(cwd, '.next-dev'))
  rm(path.join(cwd, 'node_modules'))

  // Optional caches (best-effort; harmless if missing)
  rm(path.join(cwd, '.turbo'))
  rm(path.join(cwd, '.data', '.cache'))

  console.log('[reset] done. Now run: npm install')
}

main()


