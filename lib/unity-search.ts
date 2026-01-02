import { webSearch } from '@/lib/web-search'
import { detectBusinessInventoryIntentFromText } from '@/lib/account-governance'

export type UnitySearchMode = 'financial_bills' | 'business_inventory' | 'flight_data'

export type UnitySearchParams = {
  q: string
  mode: UnitySearchMode
  date?: string | null // YYYY-MM-DD
  hour?: number | null // 0-23
  maxResults?: number
}

export type UnitySearchHit = { title: string; url: string; snippet?: string }

function safeDate(d: string | null | undefined) {
  const s = String(d || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function safeHour(h: any) {
  const n = Number(h)
  if (!Number.isFinite(n)) return null
  const i = Math.floor(n)
  if (i < 0 || i > 23) return null
  return i
}

function hourStamp(date: string | null, hour: number | null) {
  if (!date) return null
  if (hour == null) return `${date}`
  return `${date} ${String(hour).padStart(2, '0')}:00`
}

function qBase(params: UnitySearchParams) {
  const date = safeDate(params.date || null)
  const hour = safeHour(params.hour)
  const stamp = hourStamp(date, hour)
  return { q: String(params.q || '').trim(), date, hour, stamp }
}

export async function unitySearch(params: UnitySearchParams) {
  const maxResults = Math.max(1, Math.min(10, Number(params.maxResults || 6)))
  const { q, stamp } = qBase(params)
  if (!q) return { ok: false as const, error: 'Empty query', provider: 'none', results: [] as UnitySearchHit[] }

  if (params.mode === 'business_inventory') {
    // IMPORTANT: This product blocks business inventory / resale guidance by policy.
    const inv = detectBusinessInventoryIntentFromText(q)
    return {
      ok: false as const,
      error: inv.flagged
        ? 'בלאָקירט לויט פּאָליסי: Unity Credit איז נאר פאר פּערזענליכע פינאנצן, נישט פאר ביזנעס־אינווענטאר/ריסייל עצות.'
        : 'בלאָקירט לויט פּאָליסי: ביזנעס־אינווענטאר זוכ־מאָדע איז נישט בנימצא פאר באַניצער.',
      provider: 'policy',
      results: [] as UnitySearchHit[],
      blocked: true as const,
    }
  }

  if (params.mode === 'flight_data') {
    const query = stamp ? `flight data ${q} ${stamp}` : `flight data ${q}`
    const res = await webSearch(query, { maxResults })
    return { ok: res.ok, provider: res.provider, results: res.results, error: res.error }
  }

  // financial_bills
  const query = stamp ? `bill pricing ${q} ${stamp}` : `bill pricing ${q}`
  const res = await webSearch(query, { maxResults })
  return { ok: res.ok, provider: res.provider, results: res.results, error: res.error }
}


