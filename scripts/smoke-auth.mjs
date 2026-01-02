// Simple local smoke checks for auth endpoints.
// Usage: node scripts/smoke-auth.mjs http://localhost:3002

const base = (process.argv[2] || 'http://localhost:3002').replace(/\/+$/, '')

async function hit(path, init) {
  const url = `${base}${path}`
  const res = await fetch(url, init)
  const text = await res.text().catch(() => '')
  console.log(`\n${init?.method || 'GET'} ${path} -> HTTP ${res.status}`)
  if (text) console.log(text)
  return { res, text }
}

await hit('/signup')

await hit('/api/auth/otp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', purpose: 'signup' }),
})


