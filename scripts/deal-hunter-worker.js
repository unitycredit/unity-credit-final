/**
 * UnityCredit Live Deal-Hunter Worker (24/7)
 *
 * Periodically triggers:
 *   POST /api/admin/deal-hunter/run
 *
 * - Finds 25%+ discounts across the master category list (stores/providers)
 * - Updates deal feed + price history (enables "Price Crash" alerts)
 *
 * Requires:
 * - Next app reachable at NEXT_PUBLIC_APP_URL (default http://localhost:3000)
 * - ADMIN_SECRET (or dev localhost PIN) passed as x-admin-secret
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
const adminSecret = process.env.ADMIN_SECRET || process.env.DEAL_HUNTER_ADMIN_SECRET || ''
const intervalMs = Number(process.env.DEAL_HUNTER_INTERVAL_MS || 5 * 60 * 1000) // 5 minutes
const minDiscountPct = Number(process.env.DEAL_HUNTER_MIN_DISCOUNT_PCT || 25)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/admin/deal-hunter/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adminSecret ? { 'x-admin-secret': adminSecret } : {}),
    },
    body: JSON.stringify({ min_discount_pct: minDiscountPct }),
  })
  const json = await res.json().catch(() => ({}))
  const ms = Date.now() - started
  if (!res.ok) {
    console.error(`[deal-hunter-worker] FAIL ${res.status} in ${ms}ms`, json?.error || json)
    return
  }
  const deals = Array.isArray(json?.deals) ? json.deals.length : Array.isArray(json?.db?.deals) ? json.db.deals.length : 0
  console.log(`[deal-hunter-worker] OK in ${ms}ms · deals=${deals} · updated_at=${json?.updated_at ?? json?.db?.updated_at ?? '?'}`)
}

async function main() {
  console.log(`[deal-hunter-worker] starting · baseUrl=${baseUrl} · intervalMs=${intervalMs} · minDiscountPct=${minDiscountPct}`)
  while (true) {
    try {
      await runOnce()
    } catch (e) {
      console.error('[deal-hunter-worker] error', e?.message || e)
    }
    await sleep(intervalMs)
  }
}

main().catch((e) => {
  console.error('[deal-hunter-worker] fatal', e?.message || e)
  process.exit(1)
})


