/* eslint-disable no-console */
/**
 * Stress seed: generate fake users + transactions for load testing.
 *
 * Creates:
 * - 500 Supabase auth users
 * - 5,000 rows in public.plaid_transactions (10 per user)
 *
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/stress-seed.js --tag=myrun
 *   node scripts/stress-seed.js            (auto tag)
 */

const fs = require('node:fs')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function nowIso() {
  return new Date().toISOString()
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function makeTag() {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`
}

async function main() {
  const tag = String(argValue('--tag') || makeTag()).trim()
  const usersCount = Number(argValue('--users') || 500)
  const txCount = Number(argValue('--tx') || 5000)

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    console.error('Missing env. Require NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(`[stress-seed] start tag=${tag} users=${usersCount} tx=${txCount} at=${nowIso()}`)

  // Preflight: ensure table exists.
  {
    const { error } = await admin.from('plaid_transactions').select('id').limit(1)
    if (error) {
      console.error('[stress-seed] Supabase preflight failed for public.plaid_transactions:', error.message)
      console.error('[stress-seed] Make sure you ran SUPABASE_PLAID_TRANSACTIONS.sql in your Supabase SQL editor.')
      process.exit(1)
    }
  }

  const password = `UC_${tag}_Passw0rd!`
  const userIds = []

  // Create users
  for (let i = 1; i <= usersCount; i += 1) {
    const email = `stress+${tag}.${i}@example.com`
    const created = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { stress_tag: tag, stress_i: i, source: 'stress-seed' },
      })
      .catch((e) => ({ data: null, error: { message: String(e?.message || e) } }))

    if (created?.error) {
      console.error(`[stress-seed] createUser failed i=${i} email=${email}: ${created.error.message}`)
      process.exit(1)
    }

    const id = created?.data?.user?.id
    if (!id) {
      console.error(`[stress-seed] createUser returned no id i=${i} email=${email}`)
      process.exit(1)
    }
    userIds.push(id)

    if (i % 50 === 0) console.log(`[stress-seed] users created: ${i}/${usersCount}`)
  }

  // Create transactions
  const merchants = [
    { merchant: 'Verizon', cat1: 'Utilities', cat2: 'Phone', name: 'Verizon Wireless' },
    { merchant: 'AT&T', cat1: 'Utilities', cat2: 'Phone', name: 'AT&T Mobility' },
    { merchant: 'ConEd', cat1: 'Utilities', cat2: 'Electric', name: 'Con Edison' },
    { merchant: 'PSEG', cat1: 'Utilities', cat2: 'Electric', name: 'PSEG' },
    { merchant: 'Comcast', cat1: 'Utilities', cat2: 'Internet', name: 'Comcast' },
    { merchant: 'Amazon', cat1: 'Shopping', cat2: 'Online', name: 'Amazon Marketplace' },
    { merchant: 'Walmart', cat1: 'Shopping', cat2: 'Groceries', name: 'Walmart' },
    { merchant: 'Costco', cat1: 'Shopping', cat2: 'Groceries', name: 'Costco' },
    { merchant: 'Uber', cat1: 'Transport', cat2: 'Rideshare', name: 'Uber' },
    { merchant: 'Lyft', cat1: 'Transport', cat2: 'Rideshare', name: 'Lyft' },
  ]

  const rows = []
  for (let t = 0; t < txCount; t += 1) {
    const user_id = userIds[t % userIds.length]
    const m = pick(merchants)
    const amount =
      m.merchant === 'Verizon' || m.merchant === 'AT&T' || m.merchant === 'Comcast'
        ? randInt(45, 210) + randInt(0, 99) / 100
        : randInt(5, 180) + randInt(0, 99) / 100

    const occurred_on = isoDateDaysAgo(randInt(0, 120))
    const plaid_transaction_id = `stress_${tag}_${user_id.slice(0, 8)}_${t}`

    rows.push({
      user_id,
      plaid_transaction_id,
      amount,
      currency: 'usd',
      name: m.name,
      merchant_name: m.merchant,
      category_primary: m.cat1,
      category_detailed: m.cat2,
      occurred_on,
    })
  }

  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await admin.from('plaid_transactions').insert(batch)
    if (error) {
      console.error('[stress-seed] insert plaid_transactions failed:', error.message)
      process.exit(1)
    }
    console.log(`[stress-seed] transactions inserted: ${Math.min(i + batchSize, rows.length)}/${rows.length}`)
  }

  const outDir = path.join(process.cwd(), '.data', 'stress')
  ensureDir(outDir)
  const outPath = path.join(outDir, `${tag}.json`)
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        tag,
        created_at: nowIso(),
        users_count: usersCount,
        tx_count: txCount,
        password_hint: password,
        user_ids: userIds,
      },
      null,
      2
    )
  )

  console.log(`[stress-seed] done. output=${outPath}`)
  console.log(`[stress-seed] sample login email=stress+${tag}.1@example.com password=${password}`)
}

main().catch((e) => {
  console.error('[stress-seed] fatal:', e?.message || e)
  process.exit(1)
})


