import { webSearch } from '@/lib/web-search'

export type DealSource = 'walmart' | 'amazon'

export type DealHit = {
  source: DealSource
  title: string
  url: string
  snippet?: string
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function isAllowedDomain(source: DealSource, url: string) {
  const h = hostOf(url)
  if (!h) return false
  if (source === 'walmart') return h.endsWith('walmart.com')
  if (source === 'amazon') return h.endsWith('amazon.com')
  return false
}

function buildQueries(source: DealSource, keywords: string) {
  const k = String(keywords || '').trim()
  // No scraping: just return search hits for deal-related pages.
  if (source === 'walmart') {
    return [
      `site:walmart.com ${k} deals cashback`,
      `site:walmart.com ${k} clearance deal`,
      `site:walmart.com ${k} rollback deal`,
    ]
  }
  return [
    `site:amazon.com ${k} deal coupon`,
    `site:amazon.com ${k} lightning deal`,
    `site:amazon.com ${k} subscribe and save deal`,
  ]
}

export async function scanShoppingDeals(params: {
  keywords: string
  sources: DealSource[]
  maxPerQuery?: number
}) {
  const keywords = String(params.keywords || '').trim()
  const sources = Array.isArray(params.sources) && params.sources.length ? params.sources : (['walmart', 'amazon'] as DealSource[])
  const maxPerQuery = Math.max(1, Math.min(10, Number(params.maxPerQuery || 5)))

  const hits: DealHit[] = []
  const packs: Array<{ source: DealSource; query: string; ok: boolean; provider: string; error?: string }> = []

  for (const source of sources) {
    for (const q of buildQueries(source, keywords)) {
      const res = await webSearch(q, { maxResults: maxPerQuery })
      packs.push({ source, query: q, ok: res.ok, provider: res.provider, error: res.error })
      if (res.ok) {
        for (const r of res.results) {
          if (!isAllowedDomain(source, r.url)) continue
          hits.push({ source, title: r.title, url: r.url, snippet: r.snippet })
        }
      }
    }
  }

  // Dedupe by URL
  const seen = new Set<string>()
  const deduped = hits.filter((h) => {
    const u = h.url
    if (!u || seen.has(u)) return false
    seen.add(u)
    return true
  })

  return {
    ok: true as const,
    keywords,
    sources,
    provider: packs.find((p) => p.ok)?.provider || 'none',
    meta: { queries_run: packs.length, queries: packs },
    hits: deduped.slice(0, 40),
    scanned_at: new Date().toISOString(),
  }
}


