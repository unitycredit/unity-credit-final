import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'

export async function GET() {
  try {
    const cfg = getSupabaseRuntimeConfig()
    const url = cfg.url || ''
    const service = cfg.serviceRoleKey || ''

    if (!url || !service) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set .env.local, or temporarily paste into DOTENV_LOCAL_TEMPLATE.txt and restart).',
          hasSupabaseUrl: Boolean(url),
          hasServiceRoleKey: Boolean(service),
        },
        { status: 500 }
      )
    }

    const admin = createServerClient()

    // Table existence checks (information_schema is safe to query with service role)
    const tables = await admin
      .from('information_schema.tables')
      .select('table_schema,table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['users', 'credit_cards'])

    // Trigger existence checks (via pg_catalog)
    const triggers = await admin
      .from('pg_catalog.pg_trigger')
      .select('tgname')
      .in('tgname', ['on_auth_user_created'])

    return NextResponse.json({
      ok: true,
      tables: tables.data || [],
      tablesError: tables.error?.message || null,
      triggers: triggers.data || [],
      triggersError: triggers.error?.message || null,
      hints: {
        expected: {
          tables: ['public.users', 'public.credit_cards'],
          trigger: 'on_auth_user_created (on auth.users)',
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    )
  }
}


