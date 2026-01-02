import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { sanitizeInput } from '@/lib/security'
import { clamp01, normalizeMerchant } from '@/lib/unity-deals-library'

export const runtime = 'nodejs'

function bad(msgYi: string, status = 400) {
  return NextResponse.json({ ok: false, error: msgYi }, { status })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)))
  const kind = sanitizeInput(String(req.nextUrl.searchParams.get('kind') || '')).trim()
  const q = sanitizeInput(String(req.nextUrl.searchParams.get('q') || '')).trim()
  const active = sanitizeInput(String(req.nextUrl.searchParams.get('active') || '')).trim()

  let query = admin.from('unity_deals_library').select('*').order('updated_at', { ascending: false }).limit(limit)
  if (kind === 'deal' || kind === 'recurring_benchmark') query = query.eq('kind', kind)
  if (active === 'true' || active === 'false') query = query.eq('active', active === 'true')
  if (q) {
    const mq = normalizeMerchant(q)
    if (mq) query = query.ilike('merchant_norm', `%${mq}%`)
  }

  const { data, error } = await query
  if (error) return bad('מען קען נישט לייענען די Deals Library.', 500)
  return NextResponse.json({ ok: true, rows: Array.isArray(data) ? data : [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const body = (await req.json().catch(() => ({}))) as any
  const action = String(body?.action || '').trim().toLowerCase()

  if (action === 'upsert') {
    const kind = String(body?.kind || 'deal').trim()
    const category = String(body?.category || 'other').trim()
    const merchant = sanitizeInput(String(body?.merchant || '')).trim()
    const merchant_norm = normalizeMerchant(merchant)
    const notes = typeof body?.notes === 'string' ? sanitizeInput(String(body.notes)).trim() : null
    const meta = body?.meta && typeof body.meta === 'object' ? body.meta : null
    const active = typeof body?.active === 'boolean' ? Boolean(body.active) : true

    if (!merchant_norm) return bad('מערטשאַנט פעלט.')
    if (!(kind === 'deal' || kind === 'recurring_benchmark')) return bad('נישט־גילטיג kind.')

    if (kind === 'deal') {
      const saving_pct = clamp01(Number(body?.saving_pct))
      if (!(saving_pct > 0)) return bad('Saving % מוז זיין גרעסער פון 0.')

      const { data, error } = await admin
        .from('unity_deals_library')
        .upsert(
          {
            kind,
            category,
            merchant,
            merchant_norm,
            saving_pct,
            avg_monthly_price: null,
            source: 'manual',
            active,
            notes,
            meta,
          } as any,
          { onConflict: 'kind,category,merchant_norm' }
        )
        .select('*')
        .maybeSingle()
      if (error) return bad('מען האט נישט געקענט זאווען דעם דיל.', 500)
      return NextResponse.json({ ok: true, row: data }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const avg_monthly_price = Math.max(0, Number(body?.avg_monthly_price) || 0)
    if (!(avg_monthly_price > 0)) return bad('Avg monthly price מוז זיין גרעסער פון 0.')

    const { data, error } = await admin
      .from('unity_deals_library')
      .upsert(
        {
          kind,
          category,
          merchant,
          merchant_norm,
          saving_pct: null,
          avg_monthly_price,
          source: 'manual',
          active,
          notes,
          meta,
        } as any,
        { onConflict: 'kind,category,merchant_norm' }
      )
      .select('*')
      .maybeSingle()
    if (error) return bad('מען האט נישט געקענט זאווען דעם Benchmark.', 500)
    return NextResponse.json({ ok: true, row: data }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (action === 'set_active') {
    const id = String(body?.id || '').trim()
    const active = Boolean(body?.active)
    if (!id) return bad('ID פעלט.')
    const { data, error } = await admin.from('unity_deals_library').update({ active } as any).eq('id', id).select('*').maybeSingle()
    if (error) return bad('מען האט נישט געקענט אפדעיטן.', 500)
    return NextResponse.json({ ok: true, row: data }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (action === 'delete') {
    const id = String(body?.id || '').trim()
    if (!id) return bad('ID פעלט.')
    const { error } = await admin.from('unity_deals_library').delete().eq('id', id)
    if (error) return bad('מען האט נישט געקענט אויסמעקן.', 500)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return bad('נישט־באקאנט action.')
}


