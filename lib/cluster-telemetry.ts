import { upstashCmd, upstashEnabled } from '@/lib/upstash'

const ACTIVE_USERS_ZSET = 'uc:activity:active_users:v1'
const HEARTBEAT_PREFIX = 'uc:cluster:heartbeat:v1:'

function nowMs() {
  return Date.now()
}

function instanceId() {
  // Best-effort stable-ish identity for a running instance.
  const region = String(process.env.VERCEL_REGION || process.env.FLY_REGION || process.env.AWS_REGION || '').trim()
  const dep = String(process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || '').trim()
  const pid = String(process.pid)
  return `inst:${region || 'local'}:${dep || 'dev'}:${pid}`
}

export function telemetryEnabled() {
  return upstashEnabled()
}

export async function recordUserPing(userId: string) {
  if (!upstashEnabled()) return { ok: false as const, error: 'Upstash not configured' }
  const uid = String(userId || '').trim()
  if (!uid) return { ok: false as const, error: 'Missing user' }

  const ts = nowMs()
  // ZADD score=ts member=userId
  await upstashCmd(['ZADD', ACTIVE_USERS_ZSET, ts, uid]).catch(() => null)
  // Trim to ~48h to keep the ZSET bounded.
  const cutoff = ts - 48 * 60 * 60 * 1000
  await upstashCmd(['ZREMRANGEBYSCORE', ACTIVE_USERS_ZSET, 0, cutoff]).catch(() => null)

  // Heartbeat per instance (for a rough “cluster health” view)
  const hbKey = `${HEARTBEAT_PREFIX}${instanceId()}`
  await upstashCmd(['SET', hbKey, String(ts), 'EX', 45]).catch(() => null)

  return { ok: true as const }
}

export async function readActivity(windowSeconds: number) {
  if (!upstashEnabled()) return { ok: false as const, error: 'Upstash not configured' }
  const w = Math.max(5, Math.min(3600, Number(windowSeconds || 60)))
  const cutoff = nowMs() - w * 1000
  const resp = await upstashCmd<number>(['ZCOUNT', ACTIVE_USERS_ZSET, cutoff, nowMs()]).catch(() => null)
  const active = Number((resp as any)?.result || 0)
  const top = await upstashCmd<string[]>(['ZREVRANGEBYSCORE', ACTIVE_USERS_ZSET, nowMs(), cutoff, 'LIMIT', 0, 20]).catch(() => null)
  const users = Array.isArray((top as any)?.result) ? (top as any).result.map(String) : []
  return { ok: true as const, window_s: w, active_users: active, sample_users: users }
}

export async function readClusterHealth() {
  if (!upstashEnabled()) return { ok: false as const, error: 'Upstash not configured' }
  // Find up to 50 instances that have heartbeated recently.
  // Note: KEYS is avoided; instance IDs are ephemeral, so we only report this instance + redis status.
  const now = nowMs()
  const mem = process.memoryUsage()
  return {
    ok: true as const,
    now_ms: now,
    instance_id: instanceId(),
    region: String(process.env.VERCEL_REGION || process.env.FLY_REGION || 'local'),
    uptime_s: Math.round(process.uptime()),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
  }
}


