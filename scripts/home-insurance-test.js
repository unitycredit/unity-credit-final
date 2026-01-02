const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

async function main() {
  const res = await fetch(`${baseUrl}/api/admin/negotiator/insurance/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': '123456',
    },
    body: JSON.stringify({
      line: 'home',
      to: 'test@example.com',
      provider_name: '(Home Insurance Provider)',
      subject_yi: 'ביטע איבערקוקן מיין הויז־אינשורענס פאליסי',
      body_yi: '',
    }),
  })
  const json = await res.json().catch(() => ({}))
  console.log('status', res.status)
  console.log(JSON.stringify(json, null, 2))
}

main().catch((e) => {
  console.error('test failed', e?.message || e)
  process.exit(1)
})


