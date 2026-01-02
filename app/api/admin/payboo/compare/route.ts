import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { computePaybooVsPoints } from '@/lib/payboo-optimizer'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const item_price = Number(body?.item_price)
  const tax_rate_pct = Number(body?.tax_rate_pct)
  const rewards_rate_pct = Number(body?.rewards_rate_pct)
  const rewards_value_multiplier = body?.rewards_value_multiplier === undefined ? 1 : Number(body?.rewards_value_multiplier)

  const result = computePaybooVsPoints({ item_price, tax_rate_pct, rewards_rate_pct, rewards_value_multiplier })
  if (!result.ok) return NextResponse.json({ error: 'Invalid inputs', result }, { status: 400 })

  let narrative: string | null = null
  try {
    const url = new URL('/api/logic/process', req.url)
    const question = `Calculate and explain Payboo tax-savings vs card rewards for a high-ticket item.

Inputs:
- item_price=${result.item_price}
- tax_rate_pct=${result.tax_rate_pct}
- rewards_rate_pct=${result.rewards_rate_pct}
- rewards_value_multiplier=${result.rewards_value_multiplier}

Output:
- One concise recommendation (Payboo vs Rewards)
- Show the math in dollars
- Add 2-3 practical caveats (returns, merchant terms, redemption value assumptions)
Reply in professional English.`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context: { disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.' },
      }),
    })
    const j = await resp.json().catch(() => ({}))
    narrative = resp.ok ? String(j?.final || '') : null
  } catch {
    narrative = null
  }

  const merchant = sanitizeInput(String(body?.merchant || 'B&H Photo')).trim() || 'B&H Photo'

  return NextResponse.json({
    ok: true,
    merchant,
    result,
    narrative,
    mode: narrative ? 'verified' : 'offline',
    updated_at: new Date().toISOString(),
  })
}


