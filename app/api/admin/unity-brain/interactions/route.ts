import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { decryptJson, type EncBlob, vaultEncryptionEnabled } from '@/lib/vault'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

type BrainInteractionRow = {
  id: string
  created_at: string
  kind: 'chat' | 'decision' | string
  source: string
  user_id: string | null
  request_id: string | null
  encrypted_payload: EncBlob
  meta: any
}

const DEV_FILE_PATH = path.join(process.cwd(), '.data', 'brain_interactions.enc.jsonl')

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function aadForRow(row: Pick<BrainInteractionRow, 'kind' | 'source' | 'user_id' | 'request_id' | 'id'>) {
  // Must match the AAD used by `persistBrainInteraction()` (see `lib/unity-brain/interaction-store.ts`)
  return `unity_brain_interaction:v1:${row.kind}:${row.source}:${row.user_id || 'anon'}:${row.request_id || row.id}`
}

async function readFromDevFile(limit: number): Promise<BrainInteractionRow[]> {
  try {
    const raw = await fs.readFile(DEV_FILE_PATH, 'utf8')
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-limit)
      .reverse()
    const rows = lines
      .map((l) => {
        try {
          const parsed = JSON.parse(l)
          return parsed as BrainInteractionRow
        } catch {
          return null
        }
      })
      .filter(Boolean) as BrainInteractionRow[]
    return rows
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)

  const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50)))
  const id = String(req.nextUrl.searchParams.get('id') || '').trim()
  const decrypt = String(req.nextUrl.searchParams.get('decrypt') || '').trim() === '1'

  const admin = createAdminClient()
  const canUseDb = Boolean(admin)

  // Prefer Supabase, but fall back to encrypted dev file if DB isn't configured.
  let rows: BrainInteractionRow[] = []
  if (canUseDb) {
    if (id) {
      const { data, error } = await admin!
        .from('unity_brain_interactions')
        .select('*')
        .eq('id', id)
        .limit(1)
        .maybeSingle()
      if (error) return bad('מען קען נישט לייענען Unity Brain interactions.', 500)
      rows = data ? [data as any] : []
    } else {
      const { data, error } = await admin!.from('unity_brain_interactions').select('*').order('created_at', { ascending: false }).limit(limit)
      if (error) return bad('מען קען נישט לייענען Unity Brain interactions.', 500)
      rows = Array.isArray(data) ? ((data as any) as BrainInteractionRow[]) : []
    }
  } else {
    // Dev-friendly fallback
    rows = await readFromDevFile(limit)
    if (id) rows = rows.filter((r) => r.id === id)
  }

  if (!decrypt) {
    return NextResponse.json(
      { ok: true, storage: canUseDb ? 'supabase' : 'file', rows },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (!vaultEncryptionEnabled()) {
    return bad('קאנפיגוראציע פעלט (UNITY_VAULT_ENC_KEY).', 500)
  }

  const decrypted = rows.map((r) => {
    try {
      const payload = decryptJson(r.encrypted_payload as any, { expectedAad: aadForRow(r) })
      return { ...r, decrypted_payload: payload }
    } catch (e: any) {
      return { ...r, decrypted_error: String(e?.message || 'Decrypt failed') }
    }
  })

  return NextResponse.json(
    { ok: true, storage: canUseDb ? 'supabase' : 'file', rows: decrypted },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


