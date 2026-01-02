import 'server-only'
import { webSearch } from '@/lib/web-search'

export type SalesOpportunity = {
  title: string
  url: string
  snippet?: string | null
  query: string
  source: string
}

export type SalesAcceleratorResult = {
  ok: boolean
  mode: 'search' | 'offline'
  updated_at: string
  category: 'Business-Sales-Accelerator'
  keywords: string
  opportunities: SalesOpportunity[]
  note?: string | null
}

function nowIso() {
  return new Date().toISOString()
}

function safeTrim(s: any) {
  return String(s || '').trim()
}

function clampText(s: string, max: number) {
  const t = safeTrim(s)
  return t.length > max ? t.slice(0, max) : t
}

function buildQueries(keywords: string) {
  const k = keywords || 'b2b'
  return [
    `${k} b2b partnership opportunities`,
    `${k} wholesale distributor program`,
    `${k} channel partner program`,
    `${k} lead generation b2b`,
    `${k} enterprise sales prospects`,
    // Node 6-11: broaden discovery angles (press, marketplaces, affiliates, integrators, local/regional)
    `${k} strategic alliance program`,
    `${k} affiliate program b2b`,
    `${k} integration partners`,
    `${k} reseller program`,
    `${k} procurement vendor registration`,
    `${k} RFP opportunities`,
  ]
}

export async function runSalesAccelerator(params: { keywords: string; maxResultsPerQuery?: number }): Promise<SalesAcceleratorResult> {
  const keywords = clampText(params.keywords, 120) || 'b2b'
  const maxResults = Math.max(2, Math.min(8, Number(params.maxResultsPerQuery || 5)))
  const queries = buildQueries(keywords)

  // Live search may be disabled (or unconfigured) in some environments. We always return a usable response.
  const opportunities: SalesOpportunity[] = []
  let anyOk = false
  let providerName = 'unknown'

  for (const q of queries) {
    const res = await webSearch(q, { maxResults })
    providerName = res.provider || providerName
    if (!res.ok) continue
    anyOk = true
    for (const r of res.results) {
      const title = clampText(String(r.title || ''), 180)
      const url = clampText(String(r.url || ''), 500)
      if (!title || !url) continue
      opportunities.push({
        title,
        url,
        snippet: clampText(String(r.snippet || ''), 320) || null,
        query: q,
        source: providerName,
      })
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const uniq: SalesOpportunity[] = []
  for (const o of opportunities) {
    const k = o.url.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(o)
  }

  if (!anyOk) {
    return {
      ok: true,
      mode: 'offline',
      updated_at: nowIso(),
      category: 'Business-Sales-Accelerator',
      keywords,
      opportunities: [
        {
          title: 'Offline mode: configure Live Search to enable automatic B2B discovery',
          url: 'https://example.com',
          snippet: 'No live search provider is configured. Add a search key in .env.local and restart.',
          query: 'setup',
          source: 'offline',
        },
      ],
      note: 'Live Search is not configured; returned an offline placeholder.',
    }
  }

  return {
    ok: true,
    mode: 'search',
    updated_at: nowIso(),
    category: 'Business-Sales-Accelerator',
    keywords,
    opportunities: uniq.slice(0, 60),
    note: null,
  }
}


