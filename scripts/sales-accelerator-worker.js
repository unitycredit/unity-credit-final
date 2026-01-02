/* eslint-disable no-console */
/**
 * Sales Accelerator Worker (Business-Sales-Accelerator)
 *
 * Periodically triggers:
 *   POST /api/admin/sales-accelerator/run
 *
 * Requires:
 * - Next app reachable at NEXT_PUBLIC_APP_URL (default http://localhost:3000)
 * - ADMIN_SECRET passed as x-admin-secret (or your existing admin auth mechanism)
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
const adminSecret = process.env.ADMIN_SECRET || ''
const intervalMs = Number(process.env.SALES_ACCELERATOR_INTERVAL_MS || 10 * 60 * 1000) // 10 minutes
const keywords = String(process.env.SALES_ACCELERATOR_KEYWORDS || 'b2b opportunities').trim()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/admin/sales-accelerator/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    },
    body: JSON.stringify({ keywords }),
  })
  const json = await res.json().catch(() => ({}))
  const ms = Date.now() - started
  if (!res.ok) {
    console.error(`[sales-accelerator-worker] FAIL ${res.status} in ${ms}ms`, json?.error || json)
    return
  }
  const count = Array.isArray(json?.result?.opportunities) ? json.result.opportunities.length : 0
  console.log(`[sales-accelerator-worker] OK in ${ms}ms · opportunities=${count} · updated_at=${json?.result?.updated_at || '?'}`)
}

async function main() {
  console.log(`[sales-accelerator-worker] starting · baseUrl=${baseUrl} · intervalMs=${intervalMs} · keywords=${keywords}`)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce()
    } catch (e) {
      console.error('[sales-accelerator-worker] error', e?.message || e)
    }
    await sleep(intervalMs)
  }
}

main().catch((e) => {
  console.error('[sales-accelerator-worker] fatal', e?.message || e)
  process.exit(1)
})


