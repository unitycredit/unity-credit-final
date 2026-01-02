// Smoke test: OTP send -> OTP verify -> /api/auth/me (cookie-based) for local dev.
// Usage:
//   node scripts/smoke-otp-login.mjs http://localhost:3002 test@example.com
//
// Notes:
// - If the server is in DEV OTP mode, /api/auth/otp/send will return debug_code; we will use it.
// - If the server sends via Resend (no debug_code), you'll need to read the email and pass the code manually.

const base = (process.argv[2] || 'http://localhost:3002').replace(/\/+$/, '')
const email = (process.argv[3] || 'test@example.com').trim()

async function postJson(path, body, cookie = '') {
  const url = `${base}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text().catch(() => '')
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  const setCookie = res.headers.get('set-cookie') || ''
  return { res, json, setCookie }
}

async function getJson(path, cookie = '') {
  const url = `${base}${path}`
  const res = await fetch(url, { method: 'GET', headers: { ...(cookie ? { cookie } : {}) } })
  const text = await res.text().catch(() => '')
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { res, json }
}

console.log(`\n[1] OTP SEND -> ${base}/api/auth/otp/send (${email})`)
const send = await postJson('/api/auth/otp/send', { email, purpose: 'signup' })
console.log('HTTP', send.res.status, send.json)

const code = String(send.json?.debug_code || '').trim()
if (!code) {
  console.log('\nNo debug_code returned (likely Resend path).')
  console.log('Grab the 6-digit code from your email and run:')
  console.log(`  node scripts/smoke-otp-login.mjs ${base} ${email} <CODE>`)
  process.exit(0)
}

console.log(`\n[2] OTP VERIFY -> ${base}/api/auth/otp/verify (code=${code})`)
const verify = await postJson('/api/auth/otp/verify', { email, purpose: 'signup', code })
console.log('HTTP', verify.res.status, verify.json)

const cookie = verify.setCookie
if (!cookie) {
  console.log('\nNo Set-Cookie header returned. This usually means you are in DEV OTP mode (no Supabase session).')
  process.exit(0)
}

console.log('\n[3] AUTH ME -> /api/auth/me (using Set-Cookie)')
const me = await getJson('/api/auth/me', cookie)
console.log('HTTP', me.res.status, me.json)


