// Dev/Sandbox scheduled refresh helper.
// Runs a refresh against the local Next.js API endpoint.
//
// Usage:
//   node scripts/plaid-refresh.js
//
// Requires:
//   - Next dev server running on localhost:3000
//   - PLAID_REFRESH_SECRET set in .env.local
//
// Schedule at 6:00AM using Windows Task Scheduler to run:
//   cmd /c "cd /d C:\Users\chaim\Documents\UnityCredit 02 && npm run plaid:refresh"

const http = require('http')

function getEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function main() {
  const secret = getEnv('PLAID_REFRESH_SECRET')

  const options = {
    method: 'POST',
    host: 'localhost',
    port: 3000,
    path: `/api/bank/plaid/refresh?secret=${encodeURIComponent(secret)}`,
    headers: { 'Content-Type': 'application/json' },
  }

  await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Plaid refresh OK')
          resolve(null)
        } else {
          reject(new Error(`Refresh failed: ${res.statusCode}\n${data}`))
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})


