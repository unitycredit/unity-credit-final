const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

async function main() {
  const question = 'Output STRICT JSON only: {"ok": true, "note": "probe"}'
  const res = await fetch(`${baseUrl}/api/logic/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context: {} }),
  })
  const json = await res.json().catch(() => ({}))
  console.log('status', res.status)
  console.log(JSON.stringify(json, null, 2))
}

main().catch((e) => {
  console.error('probe failed', e?.message || e)
  process.exit(1)
})


