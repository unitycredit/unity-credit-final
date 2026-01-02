import type { DealSource } from '@/lib/shopping-deals'
import { scanShoppingDeals } from '@/lib/shopping-deals'
import { readCategoryCatalog } from '@/lib/category-catalog-store'
import { readLoyaltyDB } from '@/lib/loyalty-cards'

export type ShoppingScoutParams = {
  requestUrl: string
  keywords: string
  sources: DealSource[]
  maxPerQuery?: number
}

export function buildShoppingPointsQuestionYI() {
  // IMPORTANT: Keep branding neutral: "Unity Credit" + "Nodes" only.
  return `ביטע מאך א "Shopping & Points Scout" באריכט אין יידיש (פראפעשאנעל, היימיש).

איך וועל דיר געבן א ליסטע פון Walmart/Amazon לינקס (דילס/קופאנען/קלירענס) מיט טייטל און סניפּעט.

דיין ציל:
1) קלאַסיפיצירן די דילס אין 3 קאַטעגאָריעס: "טיף דיל", "נארמאל", "נישט קלאר"
2) געב א קורצע עצה פאר Points/Cashback סטראַטעגיע (איבעראל) — נישט פרעגן פאר סענסיטיווע אינפארמאציע
3) געב א Top‑10 ליסטע פון די בעסטע לינקס מיט א "וואס צו טון היינט" אקשן

געב א קלארע סטרוקטורירטע רעזולטאט.`
}

function buildOfflineShoppingReportYI(params: { keywords: string; hits: any[] }) {
  const hits = Array.isArray(params.hits) ? params.hits : []
  const hasHits = hits.length > 0
  const top = hits.slice(0, 10).map((h: any) => ({
    title: String(h?.title || '').trim(),
    url: String(h?.url || '').trim(),
    note: String(h?.snippet || '').toLowerCase().includes('clearance')
      ? 'קלירענס/ספעציעל־שפּראַך — קען זיין א טיף דיל'
      : String(h?.snippet || '').toLowerCase().includes('coupon')
      ? 'קופאן־אינדיקאציע — טשעק ביים טשעקאַוט'
      : 'נישט קלאר — קאָמפּער מיט פריערדיגע פרייס אויב מעגליך',
  }))

  return {
    ok: true,
    mode: 'offline',
    final: `Shopping & Points Scout (Offline)\n\nKeywords: ${params.keywords}\n\n${
      hasHits
        ? 'Top links:'
        : 'קיין לינקס זענען נישט געפונען געווארן ווייל Live Search איז נישט קאנפיגורירט. כדי צו באקומען Amazon/Walmart דיל־לינקס, קאנפיגורירט דעם Live Search שליסל און ריסטאַרט דעם סערווער.'
    }\n${top
      .filter((t) => t.title && t.url)
      .map((t, i) => `${i + 1}) ${t.title}\n${t.url}\n- ${t.note}`)
      .join('\n\n')}\n\nPoints/Cashback סטראַטעגיע (קיצור):\n- ניצט קאטעגאריע־באנוסן נאר אויב איר וואלט סיי־ווי געקויפט\n- קוקט פאר לעגיטימע cashback portals איידער טשעקאַוט\n- הייבט אן מיט price compare צווישן Amazon/Walmart און טראַנספּאָרט־פיעס\n\nדי דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.`,
  }
}

export async function runShoppingPointsScout(params: ShoppingScoutParams) {
  const scan = await scanShoppingDeals({
    keywords: params.keywords,
    sources: params.sources,
    maxPerQuery: params.maxPerQuery,
  })

  const question = buildShoppingPointsQuestionYI()
  const catalog = await readCategoryCatalog().catch(() => null)
  const loyalty = await readLoyaltyDB().catch(() => null)
  const context = {
    shopping: {
      keywords: params.keywords,
      sources: params.sources,
      hits: (scan as any)?.hits || [],
      scanned_at: (scan as any)?.scanned_at,
    },
    category_catalog: catalog?.categories?.slice(0, 20) || [],
    loyalty_cards: loyalty?.cards || [],
  }

  const url = new URL('/api/logic/process', params.requestUrl)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  })
  const json = await resp.json().catch(() => ({}))

  return {
    scan,
    result: resp.ok
      ? json
      : buildOfflineShoppingReportYI({
          keywords: params.keywords,
          hits: (scan as any)?.hits || [],
        }),
  }
}


