/**
 * UnityCredit Shopping Scout Worker
 *
 * Periodically triggers the admin Shopping & Points Scout:
 * - Runs deal scanning (Amazon/Walmart via webSearch)
 * - Runs internal intelligence verification through /api/logic/process
 * - Stores latest snapshot (redis or .data fallback)
 *
 * Requires:
 * - Next app running at BASE_URL (default http://localhost:3000)
 * - ADMIN_SECRET in env (sent as x-admin-secret)
 */

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const adminSecret = process.env.ADMIN_SECRET || ''
const intervalMs = Number(process.env.SHOPPING_SCOUT_INTERVAL_MS || 10 * 60 * 1000) // 10 minutes
const keywords = process.env.SHOPPING_SCOUT_KEYWORDS || 'walmart amazon deals'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/admin/shopping-scout/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    },
    body: JSON.stringify({ keywords, sources: ['walmart', 'amazon'], maxPerQuery: 5 }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
  const ms = Date.now() - started
  const hits = Array.isArray(json?.scan?.hits) ? json.scan.hits.length : 0
  console.log(`[shopping-scout-worker] OK in ${ms}ms · hits=${hits} · updated_at=${json?.updated_at || '?'}`)
}

async function main() {
  console.log(`[shopping-scout-worker] starting · baseUrl=${baseUrl} · intervalMs=${intervalMs} · keywords="${keywords}"`)
  while (true) {
    try {
      await runOnce()
    } catch (e) {
      console.error('[shopping-scout-worker] error', e?.message || e)
    }
    await sleep(intervalMs)
  }
}

main()

/**
 * UnityCredit Shopping & Points Scout Worker (24/7)
 *
 * Runs in a loop and triggers:
 *   POST /api/admin/shopping-scout/run
 *
 * Auth:
 * - Uses SHOPPING_SCOUT_SECRET via header x-shopping-scout-secret (recommended)
 *
 * Requires:
 * - Next server reachable at NEXT_PUBLIC_APP_URL (default http://localhost:3000)
 * - SHOPPING_SCOUT_SECRET set (and route will accept it)
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
const secret = process.env.SHOPPING_SCOUT_SECRET || ''
const intervalMs = Number(process.env.SHOPPING_SCOUT_INTERVAL_MS || 2 * 60 * 1000)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/admin/shopping-scout/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-shopping-scout-secret': secret } : {}),
    },
    body: JSON.stringify({ keywords: process.env.SHOPPING_SCOUT_KEYWORDS || 'walmart amazon deals', sources: ['walmart', 'amazon'], maxPerQuery: 5 }),
  })
  const json = await res.json().catch(() => ({}))
  const ms = Date.now() - started
  if (!res.ok) {
    console.error(`[shopping-scout-worker] FAIL ${res.status} in ${ms}ms`, json?.error || json)
    return
  }
  const hits = Array.isArray(json?.scan?.hits) ? json.scan.hits.length : Array.isArray(json?.scan?.result?.hits) ? json.scan.result.hits.length : 0
  console.log(`[shopping-scout-worker] OK in ${ms}ms · hits=${hits} · updated_at=${json?.updated_at ?? '?'}`)
}

async function main() {
  console.log(`[shopping-scout-worker] starting · baseUrl=${baseUrl} · intervalMs=${intervalMs}`)
  while (true) {
    try {
      await runOnce()
    } catch (e) {
      console.error('[shopping-scout-worker] error', e?.message || e)
    }
    await sleep(intervalMs)
  }
}

main().catch((e) => {
  console.error('[shopping-scout-worker] fatal', e?.message || e)
  process.exit(1)
})


