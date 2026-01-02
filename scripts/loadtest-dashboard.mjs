/**
 * Simple load test (no external deps).
 *
 * Examples:
 *   node scripts/loadtest-dashboard.mjs --url http://localhost:3000/dashboard --vus 100 --duration 20
 *   node scripts/loadtest-dashboard.mjs --url https://your-prod-domain.com/dashboard --vus 250 --duration 30 --cookie "sb-access-token=...; sb-refresh-token=..."
 *   node scripts/loadtest-dashboard.mjs --url http://localhost:3000/dashboard --vus 500 --duration 30 --think-ms 1000
 *
 * Notes:
 * - For authenticated dashboards, pass a `--cookie` string from a real session.
 * - This script reports p50/p90/p95/p99 and how many requests were <= 200ms.
 */

import { performance } from 'node:perf_hooks'
import process from 'node:process'

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx === -1) return fallback
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return fallback
  return v
}

function argInt(name, fallback) {
  const raw = argValue(name, null)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function usageAndExit(code) {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node scripts/loadtest-dashboard.mjs --url <URL> [--vus 100] [--duration 20] [--cookie "<cookie>"]',
      '',
      'Flags:',
      '  --url       Target URL (ex: http://localhost:3000/dashboard)',
      '  --vus       Concurrent users (100-500 recommended)',
      '  --duration  Duration in seconds',
      '  --cookie    Optional Cookie header for authenticated pages',
      '',
    ].join('\n')
  )
  process.exit(code)
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

async function main() {
  const url = argValue('url')
  if (!url) usageAndExit(1)

  const vus = argInt('vus', 100)
  const durationSec = argInt('duration', 20)
  const cookie = argValue('cookie', '')
  const thinkMs = argInt('think-ms', 0)

  if (vus < 1 || durationSec < 1) usageAndExit(1)
  // Note: Node's built-in `fetch` already uses a keep-alive capable HTTP client internally.

  const endAt = performance.now() + durationSec * 1000
  const latencies = []
  let ok = 0
  let bad = 0

  async function worker() {
    while (performance.now() < endAt) {
      const t0 = performance.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: cookie ? { cookie } : undefined,
          cache: 'no-store',
          redirect: 'manual',
        })
        // Read the body so we measure real end-to-end and keep sockets healthy.
        await res.arrayBuffer().catch(() => null)
        const dt = performance.now() - t0
        latencies.push(dt)
        if (res.status >= 200 && res.status < 400) ok++
        else bad++
      } catch {
        const dt = performance.now() - t0
        latencies.push(dt)
        bad++
      }
      if (thinkMs > 0) await new Promise((r) => setTimeout(r, thinkMs))
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Load testing ${url}`)
  // eslint-disable-next-line no-console
  console.log(`VUs=${vus} duration=${durationSec}s think-ms=${thinkMs} ${cookie ? '(cookie: provided)' : ''}`)

  await Promise.all(Array.from({ length: vus }, () => worker()))

  const sorted = latencies.slice().sort((a, b) => a - b)
  const total = sorted.length
  const under200 = sorted.filter((x) => x <= 200).length

  const out = {
    url,
    vus,
    duration_sec: durationSec,
    requests: total,
    ok,
    bad,
    avg_ms: total ? Number((sorted.reduce((a, b) => a + b, 0) / total).toFixed(2)) : null,
    p50_ms: percentile(sorted, 50) ? Number(percentile(sorted, 50).toFixed(2)) : null,
    p90_ms: percentile(sorted, 90) ? Number(percentile(sorted, 90).toFixed(2)) : null,
    p95_ms: percentile(sorted, 95) ? Number(percentile(sorted, 95).toFixed(2)) : null,
    p99_ms: percentile(sorted, 99) ? Number(percentile(sorted, 99).toFixed(2)) : null,
    max_ms: total ? Number(sorted[sorted.length - 1].toFixed(2)) : null,
    under_200ms_pct: total ? Number(((under200 / total) * 100).toFixed(2)) : null,
  }

  // eslint-disable-next-line no-console
  console.log('\nResults:')
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2))

  // Pass/fail signal for CI-ish usage.
  if (out.p95_ms !== null && out.p95_ms > 200) process.exitCode = 2
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})


