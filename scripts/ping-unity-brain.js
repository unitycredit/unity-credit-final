/**
 * "Alive" ping for Unity Credit (Shell) -> Unity Credit (Brain) via the secure API route.
 *
 * Usage:
 *   node scripts/ping-unity-brain.js
 *
 * Optional env:
 *   NEXT_PUBLIC_APP_URL=http://localhost:3002
 */

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3002').replace(/\/+$/, '')

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function readJson(res) {
  const text = await res.text().catch(() => '')
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: null, text }
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000
  let lastErr = ''
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/public/emergency-control`, { method: 'GET', cache: 'no-store' })
      if (res.ok) return true
      lastErr = `status ${res.status}`
    } catch (e) {
      lastErr = e?.message || String(e)
    }
    await sleep(500)
  }
  throw new Error(`Dev server not responding at ${baseUrl} (${lastErr || 'timeout'})`)
}

async function main() {
  console.log(`[ping] baseUrl: ${baseUrl}`)
  await waitForServer()
  console.log('[ping] server: OK')

  // 1) Non-secret config + reachability snapshot
  const nodesRes = await fetch(`${baseUrl}/api/health/nodes`, { method: 'GET', cache: 'no-store' })
  const nodes = await readJson(nodesRes)
  console.log(`[ping] /api/health/nodes: ${nodesRes.status}`)
  if (nodes.json) console.log(JSON.stringify(nodes.json, null, 2))
  else console.log(nodes.text.slice(0, 500))

  // 2) Secure Brain execute (Shell -> Brain -> Shell)
  const request_id = `ping-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const execRes = await fetch(`${baseUrl}/api/unity-brain/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_id,
      domain: 'savings',
      prefer_yiddish: false,
      question: 'Ping: reply with a very short confirmation sentence.',
      system: 'Unity Credit Shell health check. Confirm you are alive and responding.',
      disclaimer_yi: 'ping',
    }),
  })
  const exec = await readJson(execRes)
  console.log(`[ping] /api/unity-brain/v1: ${execRes.status}`)
  if (exec.json) console.log(JSON.stringify(exec.json, null, 2))
  else console.log(exec.text.slice(0, 800))

  const alive = execRes.ok && exec.json && exec.json.ok === true
  console.log(`[ping] ALIVE=${alive ? 'true' : 'false'}`)

  if (!alive) process.exit(2)
}

main().catch((e) => {
  console.error('[ping] FAILED:', e?.message || e)
  process.exit(1)
})


