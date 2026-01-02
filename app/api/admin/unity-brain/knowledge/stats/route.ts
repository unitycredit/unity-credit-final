import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const [assets, vault, interactions] = await Promise.all([
    admin.from('unity_knowledge_assets').select('id', { count: 'exact', head: true }),
    admin.from('unity_savings_vault').select('id', { count: 'exact', head: true }),
    admin.from('unity_brain_interactions').select('id', { count: 'exact', head: true }),
  ])

  return NextResponse.json(
    {
      ok: true,
      counts: {
        knowledge_assets: Number((assets as any)?.count || 0),
        savings_vault: Number((vault as any)?.count || 0),
        brain_interactions: Number((interactions as any)?.count || 0),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


