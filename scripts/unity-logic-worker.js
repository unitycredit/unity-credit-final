/* eslint-disable no-console */
/**
 * Unity Credit Worker (Async intelligence execution)
 *
 * Usage:
 *   node scripts/unity-logic-worker.js
 *
 * Requires:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Optional (audit encryption, matches lib/audit-trail.ts behavior):
 *   AUDIT_LOG_ENC_KEY
 */

// Keep the queue keys in sync with lib/logic-jobs.ts
const QUEUE_KEY = 'uc:logic:queue:v1'
const JOB_PREFIX = 'uc:logic:job:v1:'

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

function cfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || ''
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || ''
  return { url: url.replace(/\/$/, ''), token }
}

async function upstashCmd(command) {
  const { url, token } = cfg()
  if (!url || !token) throw new Error('Upstash not configured')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`)
  return json
}

async function upstashPipeline(commands) {
  const { url, token } = cfg()
  if (!url || !token) throw new Error('Upstash not configured')
  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`)
  return json
}

function nowIso() {
  return new Date().toISOString()
}

function jobKey(id) {
  return `${JOB_PREFIX}${id}`
}

function safeTrim(s) {
  return String(s || '').trim()
}

async function processJob(job) {
  const question = safeTrim(job?.question)
  const context = job?.context || {}
  if (!question) throw new Error('Missing question')

  // Delegate to the server’s canonical intelligence gateway so we keep
  // security overrides + sanitization in one place.
  const resp = await fetch(`${baseUrl}/api/logic/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = String(json?.error || `HTTP ${resp.status}`)
    const err = new Error(msg)
    err.details = json
    throw err
  }
  return json
}

async function main() {
  const { url, token } = cfg()
  if (!url || !token) {
    console.error('Missing Upstash config (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).')
    process.exit(1)
  }

  console.log(`[unity-logic-worker] started at ${nowIso()} · baseUrl=${baseUrl}`)

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const popped = await upstashCmd(['RPOP', QUEUE_KEY]).catch(() => null)
      const id = String(popped?.result || '').trim()
      if (!id) {
        await new Promise((r) => setTimeout(r, 800))
        continue
      }

      const raw = await upstashCmd(['GET', jobKey(id)]).catch(() => null)
      const recRaw = String(raw?.result || '')
      if (!recRaw) continue
      let job = null
      try { job = JSON.parse(recRaw) } catch { job = null }
      if (!job) continue

      // Mark running
      job.status = 'running'
      job.updated_at = nowIso()
      await upstashCmd(['SETEX', jobKey(id), 60 * 60, JSON.stringify(job)]).catch(() => null)

      try {
        const result = await processJob(job)
        job.status = 'succeeded'
        job.result = result
        job.updated_at = nowIso()
        await upstashCmd(['SETEX', jobKey(id), 60 * 60, JSON.stringify(job)]).catch(() => null)
      } catch (e) {
        job.status = 'failed'
        job.error = String(e?.message || e || 'Job failed')
        job.result = e?.details || null
        job.updated_at = nowIso()
        await upstashCmd(['SETEX', jobKey(id), 60 * 60, JSON.stringify(job)]).catch(() => null)
      }
    } catch (e) {
      console.error('[unity-logic-worker] loop error:', e?.message || e)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

main().catch((e) => {
  console.error('[unity-logic-worker] fatal:', e?.message || e)
  process.exit(1)
})


