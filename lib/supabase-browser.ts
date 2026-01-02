import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  // eslint-disable-next-line no-var
  var __UC_SUPABASE__: { url?: string; anonKey?: string } | undefined
}

type SupabaseEnvStatus = {
  url: string | null
  anonKey: string | null
  serviceRoleKey: string | null
  hasUrl: boolean
  hasAnonKey: boolean
  hasServiceRoleKey: boolean
}

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const injected =
    typeof window !== 'undefined' && (globalThis as any).__UC_SUPABASE__
      ? (globalThis as any).__UC_SUPABASE__
      : null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (injected?.url ? String(injected.url) : null)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (injected?.anonKey ? String(injected.anonKey) : null)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null
  return {
    url,
    anonKey,
    serviceRoleKey,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  }
}

export function getSupabaseAnonClient(): { client: SupabaseClient | null; error?: string } {
  const env = getSupabaseEnvStatus()
  if (!env.url || !env.anonKey) {
    return {
      client: null,
      error: 'Missing Supabase keys. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and restart the dev server.',
    }
  }
  return { client: createSupabaseJsClient(env.url, env.anonKey) }
}


