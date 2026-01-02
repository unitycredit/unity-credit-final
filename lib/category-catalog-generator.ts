import { webSearch } from '@/lib/web-search'
import { nowIso, type CategoryCatalogEntry } from '@/lib/category-catalog'
import { offlineProvidersForCategory } from '@/lib/category-catalog-offline'

function takeJson(text: string): any | null {
  const t = String(text || '').trim()
  if (!t) return null
  // Prefer array/object at start; otherwise extract first {...} or [...]
  const mObj = t.match(/\{[\s\S]*\}/)
  const mArr = t.match(/\[[\s\S]*\]/)
  const cand = mArr?.[0] && mObj?.[0] ? (mArr[0].length > mObj[0].length ? mArr[0] : mObj[0]) : mArr?.[0] || mObj?.[0]
  if (!cand) return null
  try {
    return JSON.parse(cand)
  } catch {
    return null
  }
}

function clampList<T>(arr: T[], max: number) {
  return Array.isArray(arr) ? arr.slice(0, Math.max(0, max)) : []
}

function safeUrlList(raw: any): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(String).map((u) => u.trim()).filter(Boolean).slice(0, 8)
}

export async function generateCatalogEntry(params: {
  requestUrl: string
  entry: Pick<CategoryCatalogEntry, 'key' | 'label' | 'kind'>
  maxSearchResults?: number
}) {
  const maxResults = Math.max(3, Math.min(10, Number(params.maxSearchResults || 6)))
  const label = String(params.entry.label || '').trim()
  const kind = params.entry.kind

  const queries =
    kind === 'insurance'
      ? [
          `${label} major providers discounts`,
          `${label} hidden discounts bundling safe driver loyalty`,
          `${label} promotional offers sign-up discount`,
        ]
      : [
          `site:walmart.com ${label} deal coupon cashback`,
          `site:amazon.com ${label} deal coupon`,
          `${label} best cashback points strategy walmart amazon`,
        ]

  const sources: Array<{ title: string; url: string; snippet?: string; query: string; provider: string }> = []
  for (const q of queries) {
    const res = await webSearch(q, { maxResults })
    if (res.ok) {
      for (const r of res.results) {
        sources.push({ ...r, query: q, provider: res.provider })
      }
    }
  }

  // Keep sources small to control prompt size.
  const sourcesTrim = sources
    .filter((s) => s && s.title && s.url)
    .slice(0, 18)
    .map((s) => ({ title: s.title, url: s.url, snippet: s.snippet }))

  const question = `OUTPUT STRICT JSON ONLY (no markdown, no extra text).

Build a category database entry for Unity Credit.
Branding rules: only "Unity Credit". Do NOT mention any other branding.

Category:
- key: ${params.entry.key}
- label: ${label}
- kind: ${kind}

Task:
- List major providers for this category and summarize publicly-available offers/promotions (if any) and common discount levers.
- Include a section "hidden_discounts" per provider with practical negotiation angles (e.g., bundling, loyalty, autopay, membership, safety devices, student, military, etc.).
- Every offer/discount MUST include source_urls (0-8 URLs). If you can't cite a source, set confidence="low" and source_urls=[].
- Keep it conservative: do not fabricate exact prices or expirations. Prefer "may apply" language in details.

Return JSON with this shape:
{
  "key": string,
  "label": string,
  "kind": "shopping"|"insurance",
  "providers": [
    {
      "name": string,
      "offers": [{"title":string,"details":string,"price":string,"discount":string,"expires_at":string|null,"source_urls":string[],"confidence":"high"|"medium"|"low"}],
      "hidden_discounts": [{"title":string,"how_to_claim":string,"source_urls":string[],"confidence":"high"|"medium"|"low"}],
      "source_urls": string[],
      "notes": string,
      "confidence":"high"|"medium"|"low"
    }
  ]
}

SOURCES (snippets):
${JSON.stringify(sourcesTrim, null, 2)}`

  // Live generation is disabled in the Shell; generate a high-quality offline master list so the UI is complete.
  if (true) {
    const providers = offlineProvidersForCategory({ key: params.entry.key, label, kind })
    const entry: CategoryCatalogEntry = {
      key: params.entry.key,
      label,
      kind,
      updated_at: nowIso(),
      generated_at: nowIso(),
      providers,
      sources: sourcesTrim,
      raw: 'Offline catalog.',
    }
    return { ok: providers.length > 0, entry, resp_ok: false, status: 200 }
  }

  const url = new URL('/api/logic/process', params.requestUrl)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      context: { disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.' },
    }),
  })
  const json = await resp.json().catch(() => ({}))
  const text = String(json?.final || json?.draft || '')
  const parsed = resp.ok ? takeJson(text) : null

  const providersRaw = Array.isArray(parsed?.providers) ? parsed.providers : []
  const providers = clampList(providersRaw, 12).map((p: any) => ({
    name: String(p?.name || '').trim() || 'Unknown',
    offers: clampList(Array.isArray(p?.offers) ? p.offers : [], 10).map((o: any) => ({
      title: String(o?.title || '').trim(),
      details: String(o?.details || '').trim() || undefined,
      price: String(o?.price || '').trim() || undefined,
      discount: String(o?.discount || '').trim() || undefined,
      expires_at: o?.expires_at ? String(o.expires_at) : null,
      source_urls: safeUrlList(o?.source_urls),
      confidence: String(o?.confidence || '').toLowerCase() as any,
    })),
    hidden_discounts: clampList(Array.isArray(p?.hidden_discounts) ? p.hidden_discounts : [], 10).map((d: any) => ({
      title: String(d?.title || '').trim(),
      how_to_claim: String(d?.how_to_claim || '').trim() || undefined,
      source_urls: safeUrlList(d?.source_urls),
      confidence: String(d?.confidence || '').toLowerCase() as any,
    })),
    source_urls: safeUrlList(p?.source_urls),
    notes: String(p?.notes || '').trim() || undefined,
    confidence: String(p?.confidence || '').toLowerCase() as any,
  }))

  const entry: CategoryCatalogEntry = {
    key: params.entry.key,
    label,
    kind,
    updated_at: nowIso(),
    generated_at: nowIso(),
    providers,
    sources: sourcesTrim,
    raw: parsed ? null : (text || (json && Object.keys(json).length ? JSON.stringify(json) : null)),
  }

  return { ok: Boolean(resp.ok && parsed), entry, resp_ok: resp.ok, status: resp.status }
}


