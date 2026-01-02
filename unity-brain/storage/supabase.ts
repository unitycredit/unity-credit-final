import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cfg } from '../src/config.js'

export function createStorageClient(): SupabaseClient | null {
  const url = String(cfg.supabaseUrl || '').trim()
  const key = String(cfg.supabaseServiceRoleKey || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}


