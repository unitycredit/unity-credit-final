/* eslint-disable no-console */
/**
 * Next.js on Windows can occasionally end up with a partially-written `.next/` directory
 * (e.g. after a forced stop), which can cause startup/runtime crashes like:
 *   ENOENT: no such file or directory, open ".next/routes-manifest.json"
 *
 * This guard is intentionally simple:
 * - If `.next/` exists but critical manifests are missing, wipe `.next/` so Next can regenerate cleanly.
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

function main() {
  const dirArg = String(process.argv[2] || '').trim()
  const nextDir = path.join(process.cwd(), dirArg || '.next')
  if (!exists(nextDir)) return

  const routesManifest = path.join(nextDir, 'routes-manifest.json')
  const buildManifest = path.join(nextDir, 'build-manifest.json')
  const serverDir = path.join(nextDir, 'server')

  const looksBroken = !exists(routesManifest) || !exists(buildManifest) || !exists(serverDir)
  if (!looksBroken) return

  try {
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log(`[dev] Detected broken Next cache; removed ${path.basename(nextDir)}/ for a clean startup.`)
  } catch (e) {
    // Don't hard-fail dev start if cleanup fails; Next will surface the underlying issue.
    console.warn('[dev] Failed to clean .next cache:', e && e.message ? e.message : String(e))
  }
}

main()


