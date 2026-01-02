import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { decryptPayload, vaultEncryptionEnabled, type VaultCategory, type VaultKind, type VaultRow } from '@/lib/unity-savings-vault'
import { normalizeMerchant } from '@/lib/unity-deals-library'

export const runtime = 'nodejs'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function aadForAdviceRow(params: { category: VaultCategory; merchant_norm: string }) {
  return `unity_savings_vault:advice:v1:${params.category}:${params.merchant_norm}`
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)

  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50)))
  const id = String(req.nextUrl.searchParams.get('id') || '').trim()
  const kind = String(req.nextUrl.searchParams.get('kind') || 'advice').trim().toLowerCase() as VaultKind
  const category = String(req.nextUrl.searchParams.get('category') || '').trim().toLowerCase() as VaultCategory
  const merchant_norm = normalizeMerchant(String(req.nextUrl.searchParams.get('merchant_norm') || '').trim())
  const decrypt = String(req.nextUrl.searchParams.get('decrypt') || '').trim() === '1'

  let q = admin.from('unity_savings_vault').select('*').order('last_seen_at', { ascending: false }).limit(limit)
  if (id) q = q.eq('id', id as any)
  if (kind) q = q.eq('kind', kind as any)
  if (category) q = q.eq('category', category as any)
  if (merchant_norm) q = q.eq('merchant_norm', merchant_norm as any)

  const { data, error } = await q
  if (error) return bad('מען קען נישט לייענען Unity Savings Vault.', 500)

  const rows = Array.isArray(data) ? ((data as any) as VaultRow[]) : []

  if (!decrypt) {
    return NextResponse.json({ ok: true, rows }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (!vaultEncryptionEnabled()) return bad('קאנפיגוראציע פעלט (UNITY_VAULT_ENC_KEY).', 500)

  const decrypted = rows.map((r) => {
    try {
      const expectedAad =
        String(r.kind) === 'advice' ? aadForAdviceRow({ category: r.category as VaultCategory, merchant_norm: r.merchant_norm }) : undefined
      const payload = decryptPayload(r.encrypted_payload, expectedAad ? { expectedAad } : undefined)
      return { ...r, decrypted_payload: payload }
    } catch (e: any) {
      return { ...r, decrypted_error: String(e?.message || 'Decrypt failed') }
    }
  })

  return NextResponse.json({ ok: true, rows: decrypted }, { headers: { 'Cache-Control': 'no-store' } })
}


