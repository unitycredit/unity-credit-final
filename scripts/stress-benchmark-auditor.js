/* eslint-disable no-console */
/**
 * Benchmark "Auditor verification" under load.
 *
 * Interpretation (DB-side auditor):
 * - Insert (or upsert) a unity_brain.insights row for a user + insight_key
 * - Query public.plaid_transactions for evidence (e.g., Verizon tx count in last 30d)
 * - Update the insight payload with the verification result
 * - Measure end-to-end elapsed ms per verification
 *
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 * - A seed run file from scripts/stress-seed.js in .data/stress/<tag>.json
 *
 * Usage:
 *   node scripts/stress-benchmark-auditor.js --tag=myrun --iters=50
 */

const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
const { createClient } = require('@supabase/supabase-js')

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

function nowIso() {
  return new Date().toISOString()
}

function isoDateDaysAgo(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

async function main() {
  const tag = String(argValue('--tag') || '').trim()
  const iters = Number(argValue('--iters') || 50)
  const merchant = String(argValue('--merchant') || 'Verizon').trim()
  const sinceDays = Number(argValue('--days') || 30)

  if (!tag) {
    console.error('Missing --tag. Provide the seed tag used by scripts/stress-seed.js')
    process.exit(1)
  }

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    console.error('Missing env. Require NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const seedPath = path.join(process.cwd(), '.data', 'stress', `${tag}.json`)
  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`)
    console.error('Run: node scripts/stress-seed.js --tag=<tag>')
    process.exit(1)
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
  const userIds = Array.isArray(seed?.user_ids) ? seed.user_ids : []
  if (!userIds.length) {
    console.error('Seed file has no user_ids.')
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // Preflight: ensure unity_brain.insights exists.
  {
    const { error } = await admin.from('unity_brain.insights').select('id').limit(1)
    if (error) {
      console.error('[benchmark] Preflight failed for unity_brain.insights:', error.message)
      console.error('[benchmark] Ensure you ran unity-brain/storage/UNITY_BRAIN_GLOBAL_SCHEMA.sql in Supabase.')
      process.exit(1)
    }
  }

  const since = isoDateDaysAgo(sinceDays)
  const ms = []

  console.log(`[benchmark] start tag=${tag} iters=${iters} merchant=${merchant} since=${since} at=${nowIso()}`)

  for (let i = 0; i < iters; i += 1) {
    const user_id = userIds[i % userIds.length]
    const insight_key = `stress:${tag}:${merchant.toLowerCase()}:audit`
    const t0 = performance.now()

    // 1) Ensure insight row exists
    const upsert = await admin
      .from('unity_brain.insights')
      .upsert(
        {
          user_id,
          app_id: 'unity-credit',
          domain: 'savings',
          insight_key,
          payload: { v: 1, merchant, created_by: 'stress-benchmark', tag },
        },
        { onConflict: 'user_id,insight_key' }
      )
      .select('id')
      .maybeSingle()

    if (upsert.error) {
      console.error('[benchmark] upsert insight failed:', upsert.error.message)
      process.exit(1)
    }

    // 2) "Auditor verification": evidence query under load (count-only).
    const q = await admin
      .from('plaid_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('merchant_name', merchant)
      .gte('occurred_on', since)

    if (q.error) {
      console.error('[benchmark] query plaid_transactions failed:', q.error.message)
      process.exit(1)
    }

    const count = Number(q.count || 0)
    const verified = count > 0

    // 3) Persist verification result back into the insight payload.
    const upd = await admin
      .from('unity_brain.insights')
      .update({
        payload: {
          v: 1,
          merchant,
          tag,
          auditor: {
            verified,
            merchant,
            tx_count_30d: count,
            since,
            verified_at: nowIso(),
          },
        },
      })
      .eq('user_id', user_id)
      .eq('insight_key', insight_key)

    if (upd.error) {
      console.error('[benchmark] update insight failed:', upd.error.message)
      process.exit(1)
    }

    const t1 = performance.now()
    const dt = t1 - t0
    ms.push(dt)
  }

  const sorted = [...ms].sort((a, b) => a - b)
  const avg = sorted.reduce((s, x) => s + x, 0) / (sorted.length || 1)
  const p50 = percentile(sorted, 50)
  const p95 = percentile(sorted, 95)
  const max = sorted[sorted.length - 1] || 0

  console.log('[benchmark] results (ms):')
  console.log(`  count=${sorted.length}`)
  console.log(`  avg=${avg.toFixed(1)}`)
  console.log(`  p50=${p50.toFixed(1)}`)
  console.log(`  p95=${p95.toFixed(1)}`)
  console.log(`  max=${max.toFixed(1)}`)
}

main().catch((e) => {
  console.error('[benchmark] fatal:', e?.message || e)
  process.exit(1)
})


