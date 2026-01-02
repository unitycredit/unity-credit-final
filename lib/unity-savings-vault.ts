import { createAdminClient } from '@/lib/supabase-admin'
import { encryptJson, decryptJson, type EncBlob, vaultEncryptionEnabled } from '@/lib/vault-crypto'
import { normalizeMerchant } from '@/lib/unity-deals-library'

// Re-export for API routes that import from this module.
export { vaultEncryptionEnabled }

export type VaultKind = 'pattern' | 'negotiation_success' | 'advice'
export type VaultCategory = 'insurance' | 'phone' | 'utilities' | 'internet' | 'subscription' | 'other'

export type VaultRow = {
  id: string
  kind: VaultKind
  category: VaultCategory
  merchant: string
  merchant_norm: string
  success_count: number
  last_seen_at: string
  encrypted_payload: string
  created_at: string
  updated_at: string
}

export type VaultAdvicePayload = {
  v: 1
  title_yi: string
  summary_yi?: string | null
  monthly_savings: number
  email_subject_yi?: string | null
  email_body_yi?: string | null
  provider_name?: string | null
  provider_url?: string | null
  rule_yi?: string | null
  company?: string | null
}

function db() {
  return createAdminClient()
}

export function vaultReady() {
  return vaultEncryptionEnabled() && Boolean(db())
}

function aadForAdviceRow(params: { category: VaultCategory; merchant_norm: string }) {
  return `unity_savings_vault:advice:v1:${params.category}:${params.merchant_norm}`
}

export function encryptPayload(payload: any, opts?: { aad?: string }) {
  const enc = encryptJson(payload, opts?.aad ? { aad: opts.aad } : undefined)
  return JSON.stringify(enc)
}

export function decryptPayload(encrypted_payload: string, opts?: { expectedAad?: string }) {
  const parsed = JSON.parse(String(encrypted_payload || '')) as EncBlob
  return decryptJson(parsed, opts?.expectedAad ? { expectedAad: opts.expectedAad } : undefined)
}

export async function findVaultAdviceBatch(params: { category: VaultCategory; merchant_norms: string[] }) {
  const admin = db()
  if (!admin) return []
  if (!vaultEncryptionEnabled()) return []

  const merchant_norms = Array.from(new Set((params.merchant_norms || []).map((s) => normalizeMerchant(s)).filter(Boolean))).slice(0, 80)
  if (!merchant_norms.length) return []

  const { data } = await admin
    .from('unity_savings_vault')
    .select('*')
    .eq('kind', 'advice')
    .eq('category', params.category)
    .in('merchant_norm', merchant_norms as any)
    .order('last_seen_at', { ascending: false })
    .limit(200)

  return Array.isArray(data) ? ((data as any) as VaultRow[]) : []
}

export async function upsertVaultAdvice(params: {
  category: VaultCategory
  merchant: string
  payload: VaultAdvicePayload
}) {
  const admin = db()
  if (!admin) return null
  if (!vaultEncryptionEnabled()) return null

  const merchant = String(params.merchant || '').trim()
  const merchant_norm = normalizeMerchant(merchant)
  if (!merchant_norm) return null

  const encrypted_payload = encryptPayload(params.payload, { aad: aadForAdviceRow({ category: params.category, merchant_norm }) })

  // Read existing to maintain success_count
  let existing: any = null
  try {
    const resp = await admin
      .from('unity_savings_vault')
      .select('id,success_count')
      .eq('kind', 'advice')
      .eq('category', params.category)
      .eq('merchant_norm', merchant_norm)
      .limit(1)
      .maybeSingle()
    existing = (resp as any)?.data || null
  } catch {
    existing = null
  }

  const nextCount = Math.min(1_000_000, Math.max(1, Number(existing?.success_count || 0)) + 1)

  const { data } = await admin
    .from('unity_savings_vault')
    .upsert(
      {
        kind: 'advice',
        category: params.category,
        merchant,
        merchant_norm,
        success_count: nextCount,
        last_seen_at: new Date().toISOString(),
        encrypted_payload,
      } as any,
      { onConflict: 'kind,category,merchant_norm' }
    )
    .select('*')
    .maybeSingle()

  return (data as any) as VaultRow | null
}


