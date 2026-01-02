import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'
export { createClient } from '@/lib/supabase-server'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'

type SupabaseEnvStatus = {
  url: string | null
  anonKey: string | null
  serviceRoleKey: string | null
  hasUrl: boolean
  hasAnonKey: boolean
  hasServiceRoleKey: boolean
}

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
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
  // Back-compat: prefer importing from `@/lib/supabase-browser` in Client Components.
  const env = getSupabaseEnvStatus()
  if (!env.url || !env.anonKey) {
    return {
      client: null,
      error: 'Missing Supabase keys. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the dev server.',
    }
  }
  return { client: createSupabaseJsClient(env.url, env.anonKey) }
}

// Service-role client (server-only). Safe: throws only when called.
export function createServerClient(): SupabaseClient {
  const cfg = getSupabaseRuntimeConfig()
  if (!cfg.url || !cfg.serviceRoleKey) {
    throw new Error(
      'Missing Supabase service role key. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (or paste into DOTENV_LOCAL_TEMPLATE.txt for temporary dev).'
    )
  }
  return createSupabaseJsClient(cfg.url, cfg.serviceRoleKey, { auth: { persistSession: false } })
}

