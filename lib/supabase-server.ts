import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'

export async function createClient() {
  const cookieStore = await cookies()
  const cfg = getSupabaseRuntimeConfig()
  if (!cfg.url || !cfg.anonKey) {
    throw new Error(
      'Missing Supabase keys. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (or paste them into DOTENV_LOCAL_TEMPLATE.txt for temporary dev).'
    )
  }

  return createServerClient(
    cfg.url,
    cfg.anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting errors
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie removal errors
          }
        },
      },
    }
  )
}

