/**
 * UnityCredit Optimization Engine Worker (24/7)
 *
 * Runs in a loop and triggers:
 *   POST /api/optimization/run
 *
 * This is intended for a dedicated long-running process (VM/container).
 * For serverless, use a scheduler to hit the same endpoint periodically.
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
const secret = process.env.OPTIMIZATION_ENGINE_SECRET || ''
const intervalMs = Number(process.env.OPTIMIZATION_INTERVAL_MS || 5 * 60 * 1000)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runOnce() {
  const started = Date.now()
  const res = await fetch(`${baseUrl}/api/optimization/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-optimization-secret': secret } : {}),
    },
    body: JSON.stringify({}),
  })
  const json = await res.json().catch(() => ({}))
  const ms = Date.now() - started
  if (!res.ok) {
    console.error(`[optimization-worker] FAIL ${res.status} in ${ms}ms`, json?.error || json)
    return
  }
  console.log(
    `[optimization-worker] OK in ${ms}ms · refresh_count=${json?.refresh_count ?? '?'} · updated_at=${json?.updated_at ?? '?'}`
  )
}

async function main() {
  console.log(`[optimization-worker] starting · baseUrl=${baseUrl} · intervalMs=${intervalMs}`)
  while (true) {
    try {
      await runOnce()
    } catch (e) {
      console.error('[optimization-worker] error', e?.message || e)
    }
    await sleep(intervalMs)
  }
}

main().catch((e) => {
  console.error('[optimization-worker] fatal', e?.message || e)
  process.exit(1)
})


