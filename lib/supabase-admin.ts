import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'

export type AdminClientEnvStatus = {
  ok: boolean
  runtime: string | null
  url: string | null
  hasUrl: boolean
  hasServiceRoleKey: boolean
  serviceRoleJwtRole: string | null
  errors: string[]
}

function base64UrlDecodeToString(input: string) {
  // base64url -> base64
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return Buffer.from(b64 + pad, 'base64').toString('utf8')
}

function supabaseJwtRole(jwt: string): string | null {
  // Supabase keys are JWTs (anon/service_role). We best-effort validate "role" claim.
  try {
    const parts = String(jwt || '').split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(base64UrlDecodeToString(parts[1]))
    const role = typeof payload?.role === 'string' ? payload.role : null
    return role
  } catch {
    return null
  }
}

export function getAdminClientEnvStatus(): AdminClientEnvStatus {
  const runtime = String(process.env.NEXT_RUNTIME || '').trim() || null

  // URL isn't secret; allow NEXT_PUBLIC fallback for compatibility.
  const cfg = getSupabaseRuntimeConfig()
  const url = cfg.url
  const serviceKey = String(cfg.serviceRoleKey || '').trim()

  const errors: string[] = []
  if (runtime === 'edge') errors.push('Admin client cannot run in Edge runtime (service-role key must never run on edge).')
  if (!url) errors.push('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.')
  if (!serviceKey) errors.push('Missing SUPABASE_SERVICE_ROLE_KEY.')

  // Security: require HTTPS in production.
  if (url) {
    try {
      const u = new URL(url)
      if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
        errors.push('SUPABASE_URL must be https:// in production.')
      }
    } catch {
      errors.push('SUPABASE_URL is not a valid URL.')
    }
  }

  // Security: ensure the supplied key is actually a service_role key.
  const role = serviceKey ? supabaseJwtRole(serviceKey) : null
  if (role && role !== 'service_role') errors.push('SUPABASE_SERVICE_ROLE_KEY is not a service_role key.')

  return {
    ok: errors.length === 0,
    runtime,
    url,
    hasUrl: Boolean(url),
    hasServiceRoleKey: Boolean(serviceKey),
    serviceRoleJwtRole: role,
    errors,
  }
}

export function createAdminClient() {
  // IMPORTANT: service-role MUST never run in Edge runtime.
  if (process.env.NEXT_RUNTIME === 'edge') return null

  // URL isn't secret; allow NEXT_PUBLIC fallback for compatibility.
  const cfg = getSupabaseRuntimeConfig()
  const url = String(cfg.url || '').trim()
  const serviceKey = String(cfg.serviceRoleKey || '').trim()
  if (!url || !serviceKey) return null

  // Security: require HTTPS in production.
  try {
    const u = new URL(url)
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') return null
  } catch {
    return null
  }

  // Security: ensure the supplied key is actually a service_role key.
  const role = supabaseJwtRole(serviceKey)
  if (role && role !== 'service_role') return null

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function createAdminClientOrThrow() {
  const status = getAdminClientEnvStatus()
  if (!status.ok) {
    throw new Error(`Supabase admin client is not configured: ${status.errors.join(' ')}`)
  }
  const client = createAdminClient()
  if (!client) {
    // Should be unreachable if status.ok, but keep it defensive.
    throw new Error('Supabase admin client could not be created. Check env vars and runtime.')
  }
  return client
}


