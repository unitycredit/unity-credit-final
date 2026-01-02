import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { runDealHunterOnce } from '@/lib/deal-hunter-runner'
import { appendGlobal, readGlobalNotifications, writeGlobalNotifications } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const minDiscountPct = Number(body?.min_discount_pct ?? 25)
  const out = await runDealHunterOnce({ minDiscountPct })

  // Emit global notifications for new 25%+ deals (best-effort).
  try {
    const db = await readGlobalNotifications()
    let next = db
    const deals = Array.isArray((out as any)?.deals) ? (out as any).deals : []
    for (const d of deals.slice(0, 50)) {
      if (!d?.id) continue
      const title = `${String(d.store || 'Deal')} · ${Number(d.discount_pct || 0)}%+`
      const sale = typeof d.price === 'number' ? d.price : null
      const orig = typeof d.prev_price === 'number' ? d.prev_price : null
      const savings = sale && orig && orig > sale ? Math.round((orig - sale) * 100) / 100 : null
      next = appendGlobal(next, {
        id: `notif-deal-${String(d.id)}`,
        kind: 'deal',
        title,
        body: d.buy_now_reason || null,
        created_at: String(d.observed_at || new Date().toISOString()),
        deal: {
          store: String(d.store || ''),
          title: String(d.title || ''),
          url: String(d.url || ''),
          discount_pct: Number(d.discount_pct || 0),
          price: sale,
          prev_price: orig,
          savings_amount: savings,
          price_crash: Boolean(d.price_crash),
        },
        meta: { source: 'deal_hunter' },
      })
    }
    await writeGlobalNotifications(next)
  } catch {
    // ignore
  }

  return NextResponse.json({ ...out, ok: true })
}


