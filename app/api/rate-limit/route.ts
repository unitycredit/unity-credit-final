import { NextRequest, NextResponse } from 'next/server'
import { RATE_LIMITS } from '@/lib/security'

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(
  identifier: string,
  limit: { windowMs: number; max: number }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  if (!record || now > record.resetTime) {
    // Create new record
    const resetTime = now + limit.windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: limit.max - 1, resetTime }
  }

  if (record.count >= limit.max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  // Increment count
  record.count++
  rateLimitStore.set(identifier, record)
  return {
    allowed: true,
    remaining: limit.max - record.count,
    resetTime: record.resetTime,
  }
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  })
}, 60000) // Clean every minute

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const identifier = String(body?.identifier || '').trim()
    const limitKey = String(body?.limitKey || '').trim()

    if (!identifier) {
      return NextResponse.json({ error: 'Missing identifier' }, { status: 400 })
    }

    const limit =
      (RATE_LIMITS as any)[limitKey] ||
      (body?.limit && typeof body.limit.windowMs === 'number' && typeof body.limit.max === 'number'
        ? { windowMs: body.limit.windowMs, max: body.limit.max }
        : null)

    if (!limit) {
      return NextResponse.json(
        { error: 'Missing or invalid limit. Provide limitKey or {limit:{windowMs,max}}.' },
        { status: 400 }
      )
    }

    const result = checkRateLimit(identifier, limit)
    return NextResponse.json(result, { status: result.allowed ? 200 : 429 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Rate limit error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

