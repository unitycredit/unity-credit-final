type WebSearchResult = { title: string; url: string; snippet?: string }

// Simple in-memory cache (per server process)
const cache = new Map<string, { ts: number; results: WebSearchResult[] }>()
const TTL_MS = 10 * 60 * 1000

export async function webSearch(
  query: string,
  opts?: { maxResults?: number }
): Promise<{ ok: boolean; provider: string; results: WebSearchResult[]; error?: string }> {
  const q = String(query || '').trim()
  if (!q) return { ok: false, provider: 'none', results: [], error: 'Empty query' }
  const maxResults = Math.max(1, Math.min(20, Number(opts?.maxResults || 5)))

  const now = Date.now()
  const cacheKey = `${q}::${maxResults}`
  const hit = cache.get(cacheKey)
  if (hit && now - hit.ts < TTL_MS) {
    return { ok: true, provider: 'cache', results: hit.results }
  }

  // Live web search is intentionally disabled in the Shell.
  // All intelligence enrichment must run inside the standalone Brain service.
  cache.set(cacheKey, { ts: now, results: [] })
  return { ok: false, provider: 'disabled', results: [], error: 'Live search disabled' }
}


