import { createAdminClient } from '@/lib/supabase-admin'

export type UnityDealKind = 'deal' | 'recurring_benchmark'
export type UnityDealCategory = 'insurance' | 'phone' | 'utilities' | 'internet' | 'subscription' | 'other'

export type UnityDealLibraryRow = {
  id: string
  kind: UnityDealKind
  category: UnityDealCategory
  merchant: string
  merchant_norm: string
  saving_pct: number | null
  avg_monthly_price: number | null
  sample_count: number
  source: 'engine' | 'manual'
  active: boolean
  notes: string | null
  meta: any
  created_at: string
  updated_at: string
}

export function normalizeMerchant(input: string) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function computeSavingsFromPct(monthlyEstimate: number, savingPct: number) {
  const est = Number(monthlyEstimate) || 0
  const pct = clamp01(Number(savingPct) || 0)
  return Math.max(0, Math.round(est * pct))
}

export function recurringBillAboveCommunityAverage(params: { monthly_estimate: number; community_avg_monthly: number; threshold_pct?: number }) {
  const threshold = Number(params.threshold_pct ?? 0.15)
  const current = Number(params.monthly_estimate) || 0
  const avg = Number(params.community_avg_monthly) || 0
  if (!(avg > 0) || !(current > 0) || !(threshold > 0)) return { flagged: false, delta: 0, pct_over: 0 }
  const pctOver = (current - avg) / avg
  const flagged = pctOver >= threshold
  const delta = flagged ? Math.max(0, Math.round(current - avg)) : 0
  return { flagged, delta, pct_over: pctOver }
}

function db() {
  return createAdminClient()
}

export async function findActiveLibraryRow(params: { kind: UnityDealKind; category: UnityDealCategory; merchant: string }) {
  const admin = db()
  if (!admin) return null
  const merchant_norm = normalizeMerchant(params.merchant)
  if (!merchant_norm) return null
  const { data } = await admin
    .from('unity_deals_library')
    .select('*')
    .eq('kind', params.kind)
    .eq('category', params.category)
    .eq('merchant_norm', merchant_norm)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const normalized = {
    ...(data as any),
    source: String((data as any)?.source || '').trim().toLowerCase() === 'manual' ? 'manual' : 'engine',
  }
  return normalized as any as UnityDealLibraryRow
}

export async function findActiveLibraryRowsBatch(params: { kind: UnityDealKind; categories: UnityDealCategory[]; merchant_norms: string[] }) {
  const admin = db()
  if (!admin) return []
  const merchant_norms = Array.from(new Set((params.merchant_norms || []).map((s) => normalizeMerchant(s)).filter(Boolean))).slice(0, 60)
  const categories = Array.from(new Set((params.categories || []).map((c) => String(c)).filter(Boolean))) as UnityDealCategory[]
  if (!merchant_norms.length || !categories.length) return []

  const { data } = await admin
    .from('unity_deals_library')
    .select('*')
    .eq('kind', params.kind)
    .eq('active', true)
    .in('category', categories as any)
    .in('merchant_norm', merchant_norms as any)
    .limit(400)

  const rows = Array.isArray(data) ? (data as any[]) : []
  return rows.map((r) => ({ ...r, source: String(r?.source || '').trim().toLowerCase() === 'manual' ? 'manual' : 'engine' })) as any
}

export async function upsertDealPattern(params: {
  category: UnityDealCategory
  merchant: string
  saving_pct: number
  source: 'engine' | 'manual'
  notes?: string | null
  meta?: any
}) {
  const admin = db()
  if (!admin) return null
  const merchant = String(params.merchant || '').trim()
  const merchant_norm = normalizeMerchant(merchant)
  const saving_pct = clamp01(Number(params.saving_pct) || 0)
  if (!merchant_norm || !(saving_pct > 0)) return null

  const existing = await findActiveLibraryRow({ kind: 'deal', category: params.category, merchant })
  if (existing?.id) {
    const prevCount = Math.max(1, Number(existing.sample_count || 1))
    const prevAvg = clamp01(Number(existing.saving_pct || 0))
    const nextCount = Math.min(50_000, prevCount + 1)
    const nextAvg = clamp01((prevAvg * prevCount + saving_pct) / nextCount)
    const { data } = await admin
      .from('unity_deals_library')
      .update({
        merchant,
        saving_pct: nextAvg,
        sample_count: nextCount,
        source: existing.source === 'manual' ? 'manual' : params.source,
        notes: typeof params.notes === 'string' ? params.notes : existing.notes,
        meta: params.meta ?? existing.meta ?? null,
        active: true,
      } as any)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle()
    return (data as any) as UnityDealLibraryRow | null
  }

  const { data } = await admin
    .from('unity_deals_library')
    .insert({
      kind: 'deal',
      category: params.category,
      merchant,
      merchant_norm,
      saving_pct,
      avg_monthly_price: null,
      sample_count: 1,
      source: params.source,
      active: true,
      notes: typeof params.notes === 'string' ? params.notes : null,
      meta: params.meta ?? null,
    } as any)
    .select('*')
    .maybeSingle()
  return (data as any) as UnityDealLibraryRow | null
}

export async function upsertRecurringBenchmark(params: {
  category: UnityDealCategory
  merchant: string
  avg_monthly_price: number
  source: 'engine' | 'manual'
  notes?: string | null
  meta?: any
}) {
  const admin = db()
  if (!admin) return null
  const merchant = String(params.merchant || '').trim()
  const merchant_norm = normalizeMerchant(merchant)
  const avg_monthly_price = Math.max(0, Number(params.avg_monthly_price) || 0)
  if (!merchant_norm || !(avg_monthly_price > 0)) return null

  const existing = await findActiveLibraryRow({ kind: 'recurring_benchmark', category: params.category, merchant })
  if (existing?.id) {
    const prevCount = Math.max(1, Number(existing.sample_count || 1))
    const prevAvg = Math.max(0, Number(existing.avg_monthly_price || 0))
    const nextCount = Math.min(50_000, prevCount + 1)
    const nextAvg = Math.max(0, (prevAvg * prevCount + avg_monthly_price) / nextCount)
    const { data } = await admin
      .from('unity_deals_library')
      .update({
        merchant,
        avg_monthly_price: nextAvg,
        sample_count: nextCount,
        source: existing.source === 'manual' ? 'manual' : params.source,
        notes: typeof params.notes === 'string' ? params.notes : existing.notes,
        meta: params.meta ?? existing.meta ?? null,
        active: true,
      } as any)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle()
    return (data as any) as UnityDealLibraryRow | null
  }

  const { data } = await admin
    .from('unity_deals_library')
    .insert({
      kind: 'recurring_benchmark',
      category: params.category,
      merchant,
      merchant_norm,
      saving_pct: null,
      avg_monthly_price,
      sample_count: 1,
      source: params.source,
      active: true,
      notes: typeof params.notes === 'string' ? params.notes : null,
      meta: params.meta ?? null,
    } as any)
    .select('*')
    .maybeSingle()
  return (data as any) as UnityDealLibraryRow | null
}


