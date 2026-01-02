import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { activeSpecials, readWeeklySpecialsDB, type SpecialsLocation } from '@/lib/weekly-specials'
import { readLoyaltyDB } from '@/lib/loyalty-cards'

function isLocation(x: string): x is SpecialsLocation {
  return x === 'williamsburg' || x === 'boro_park' || x === 'monsey' || x === 'lakewood'
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any
  const locationRaw = sanitizeInput(String(body?.location || 'williamsburg')).trim()
  if (!isLocation(locationRaw)) return NextResponse.json({ error: 'Invalid location' }, { status: 400 })

  const db = await readWeeklySpecialsDB()
  const rows = activeSpecials(db).filter((s) => s.location === locationRaw)

  const evergreen = rows.filter((r) => r.store === 'Evergreen')
  const bingo = rows.filter((r) => r.store === 'Bingo Wholesale')

  // Normalize by item string (best-effort).
  const byItem = new Map<string, any>()
  for (const r of rows) {
    const k = String(r.item || '').toLowerCase().trim()
    if (!k) continue
    const prev = byItem.get(k) || { item: r.item, evergreen: null, bingo: null }
    if (r.store === 'Evergreen') prev.evergreen = r
    if (r.store === 'Bingo Wholesale') prev.bingo = r
    byItem.set(k, prev)
  }

  const comparisons = Array.from(byItem.values()).map((x) => {
    const e = x.evergreen
    const b = x.bingo
    const winner =
      e && b
        ? e.price < b.price
          ? 'Evergreen'
          : b.price < e.price
          ? 'Bingo Wholesale'
          : 'tie'
        : e
        ? 'Evergreen'
        : b
        ? 'Bingo Wholesale'
        : 'unknown'
    return {
      item: x.item,
      winner,
      evergreen_price: e?.price ?? null,
      bingo_price: b?.price ?? null,
      delta: e && b ? Math.round((e.price - b.price) * 100) / 100 : null,
    }
  })

  const loyalty = await readLoyaltyDB().catch(() => null)
  const cards = Array.isArray(loyalty?.cards) ? loyalty.cards : []
  const evercard = cards.find((c: any) => c.key === 'evercard') || null
  const bingoMembership = cards.find((c: any) => c.key === 'bingo_membership') || null

  let narrative: string | null = null
  try {
    const url = new URL('/api/logic/process', req.url)
    const question = `Make a smart comparison report for Evergreen vs Bingo Wholesale for location=${locationRaw}.
Use the weekly specials list and loyalty cards info. Output a structured Yiddish report with:
- What to buy at Bingo vs Evergreen this week
- Caveats about bulk buys
- How Evercard/Bingo Membership affects strategy (if points are present)
Keep it conservative and practical.`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context: {
          disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
          specials: rows.slice(0, 80),
          loyalty_cards: cards,
        },
      }),
    })
    const j = await resp.json().catch(() => ({}))
    narrative = resp.ok ? String(j?.final || '') : null
  } catch {
    narrative = null
  }

  return NextResponse.json({
    ok: true,
    location: locationRaw,
    counts: { total: rows.length, evergreen: evergreen.length, bingo: bingo.length },
    loyalty: { evercard_points: evercard?.points ?? null, bingo_membership_points: bingoMembership?.points ?? null },
    comparisons,
    narrative,
    mode: narrative ? 'verified' : 'offline',
  })
}


