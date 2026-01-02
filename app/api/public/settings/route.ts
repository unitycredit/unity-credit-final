import { NextRequest, NextResponse } from 'next/server'
import { readAdminSettings } from '@/lib/admin-settings'

export async function GET(_req: NextRequest) {
  const settings = await readAdminSettings()
  // Public-safe subset
  const res = NextResponse.json({
    ok: true,
    settings: {
      disclaimer_yi: settings.disclaimer_yi,
      heimishe_categories: settings.heimishe_categories,
      require_all_nodes: settings.require_all_nodes, // not secret; drives UX expectations
    },
  })
  // Cache for speed (admin edits propagate quickly via revalidation window)
  res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
  return res
}


