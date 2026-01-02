import type { NextRequest } from 'next/server'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

/**
 * Server-side rate limit stub.
 *
 * This repo previously referenced a shared rate limiter for premium/admin-center routes.
 * For now we keep it deterministic and safe:
 * - In dev, allow by default.
 * - In production, use Upstash Redis when configured (sliding-ish fixed window).
 * - Always provide standard headers for downstream callers.
 *
 * You can replace this with a real limiter (Upstash, KV, etc.) later without changing route code.
 */

type LimitCfg = { limit: number; windowSeconds: number }

const LIMITS: Record<string, LimitCfg> = {
  // Generic API burst protection (per IP)
  API_REQUESTS: { limit: 240, windowSeconds: 60 }, // 4 r/s
  // Auth/OTP
  OTP_SEND: { limit: 12, windowSeconds: 60 }, // per IP
  OTP_VERIFY: { limit: 30, windowSeconds: 60 }, // per IP
  OTP_SEND_EMAIL: { limit: 4, windowSeconds: 60 }, // per email hash
  OTP_VERIFY_EMAIL: { limit: 10, windowSeconds: 60 }, // per email hash
  LOGIN_ATTEMPTS: { limit: 20, windowSeconds: 60 }, // per IP (API/auth/login + server action)
  LOGIN_ATTEMPTS_EMAIL: { limit: 8, windowSeconds: 60 }, // per email hash
  // User outbound (negotiation drafts to providers)
  NEGOTIATOR_SEND: { limit: 6, windowSeconds: 60 }, // per IP
  // Hot read endpoints that can be hit frequently by dashboards
  ACTIVE_SAVINGS_READS: { limit: 600, windowSeconds: 60 }, // 10 r/s
  MONTHLY_SAVINGS_SUMMARY_READS: { limit: 300, windowSeconds: 60 }, // 5 r/s
  OPTIMIZATION_READS: { limit: 240, windowSeconds: 60 },
  // Heavy endpoints
  OPTIMIZATION_RUNS: { limit: 8, windowSeconds: 60 },
  LOGIC_PROCESS: { limit: 30, windowSeconds: 60 },
  // Search
  SEARCH_READS: { limit: 120, windowSeconds: 60 }, // per IP
}

function getIp(req: NextRequest) {
  const h = req.headers
  const xff = String(h.get('x-forwarded-for') || '').split(',')[0]?.trim()
  const real = String(h.get('x-real-ip') || '').trim()
  const cf = String(h.get('cf-connecting-ip') || '').trim()
  return xff || real || cf || 'unknown'
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function windowKey(nowS: number, windowSeconds: number) {
  return Math.floor(nowS / windowSeconds)
}

async function enforceRateLimitByKey(req: NextRequest, limitKey: string, key: string) {
  const cfg = LIMITS[limitKey] || LIMITS.API_REQUESTS
  const nowS = nowSeconds()
  const w = windowKey(nowS, cfg.windowSeconds)
  const resetS = (w + 1) * cfg.windowSeconds

  // Dev fallback: allow, but still send headers so callers can rely on them.
  if (process.env.NODE_ENV !== 'production' || !upstashEnabled()) {
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(cfg.limit),
        'X-RateLimit-Remaining': String(cfg.limit),
        'X-RateLimit-Reset': String(resetS),
      } as Record<string, string>,
    }
  }

  const redisKey = `uc:rl:${limitKey}:${key}:${w}`

  // Best-effort Upstash limiter: INCR + set expire on first hit.
  // If Redis is unavailable, fail open (availability > perfect limiting).
  const incr = await upstashCmd<number>(['INCR', redisKey]).catch(() => null)
  const count = Number((incr as any)?.result || 0) || 0
  if (count === 1) {
    await upstashCmd(['EXPIRE', redisKey, cfg.windowSeconds]).catch(() => null)
  }
  const remaining = Math.max(0, cfg.limit - count)
  const allowed = count <= cfg.limit || cfg.limit <= 0

  return {
    allowed,
    headers: {
      'X-RateLimit-Limit': String(cfg.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(resetS),
    } as Record<string, string>,
  }
}

export async function enforceRateLimit(req: NextRequest, limitKey: string) {
  const ip = getIp(req)
  return enforceRateLimitByKey(req, limitKey, ip)
}

/**
 * Keyed rate limiting (e.g. by email hash).
 * Use alongside the IP-based limit for better brute force protection.
 */
export async function enforceRateLimitKeyed(req: NextRequest, limitKey: string, key: string) {
  const safe = String(key || '').trim() || 'unknown'
  return enforceRateLimitByKey(req, limitKey, safe)
}


