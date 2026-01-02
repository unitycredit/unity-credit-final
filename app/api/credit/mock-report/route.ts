import { NextRequest, NextResponse } from 'next/server'

function isLast4(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}$/.test(v)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const last4 = body?.last4

    if (!isLast4(last4)) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן' }, { status: 400 })
    }

    // Mock only: no SSN storage, no logging, no external calls.
    // Slightly vary the mock report by last4 to feel realistic.
    const seed = parseInt(last4, 10) % 7
    const score = 705 + seed * 6 // 705..741
    const utilizationPct = 18 + seed * 3 // 18..36

    const negativeItems =
      seed >= 5
        ? [
            { type: 'שפעטע באצאלונג', detail: '30 טעג שפעט (1x) - 2024', impact: 'מיטל' },
            { type: 'הארדע אינקוויירי', detail: 'קרעדיט טשעק - 2025', impact: 'נידעריג' },
          ]
        : seed >= 3
        ? [{ type: 'הארדע אינקוויירי', detail: 'קרעדיט טשעק - 2025', impact: 'נידעריג' }]
        : []

    return NextResponse.json({
      score,
      status: score >= 740 ? 'Excellent' : score >= 700 ? 'Good' : 'Fair',
      utilizationPct,
      totalAccounts: 4 + (seed % 3),
      negativeItems,
      notes: [
        'האלט אויטניצאציע אונטער 30% פאר בעסערע סקאר.',
        'צאל פונקטליך יעדע חודש צו האלטן א ריינע היסטאריע.',
        'רעדוציר הויך-APR באלאנסן צו מינימיזירן אינטערעסט.',
      ],
    })
  } catch {
    return NextResponse.json({ error: 'א טעות איז פארגעקומען' }, { status: 500 })
  }
}


