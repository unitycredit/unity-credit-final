import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { encryptBytes, vaultEncryptionEnabled } from '@/lib/vault'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

const BUCKET = 'unity-knowledge'
const DEFAULT_CATEGORY = 'general'

function normalizeCategory(input: string | null) {
  const c = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (!c) return DEFAULT_CATEGORY
  // allow: researcher, negotiator, deal_hunter, shopping_scout, sales_accelerator, etc.
  if (!/^[a-z0-9_]{2,32}$/.test(c)) return DEFAULT_CATEGORY
  return c
}

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex')
}

function bad(msgYi: string, status = 400) {
  return NextResponse.json({ ok: false, error: msgYi }, { status })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)

  const limit = Math.max(1, Math.min(300, Number(req.nextUrl.searchParams.get('limit') || 100)))
  const category = normalizeCategory(req.nextUrl.searchParams.get('category'))
  let q: any = admin.from('unity_knowledge_assets').select('*').order('created_at', { ascending: false }).limit(limit)
  if (category && category !== 'all' && category !== DEFAULT_CATEGORY) {
    q = q.like('storage_path', `vault/${category}/%`)
  }
  const { data, error } = await q
  if (error) return bad('מען קען נישט לייענען Knowledge Center.', 500)
  return NextResponse.json({ ok: true, rows: Array.isArray(data) ? data : [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)
  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)
  if (!vaultEncryptionEnabled()) return bad('קאנפיגוראציע פעלט (UNITY_VAULT_ENC_KEY).', 500)

  const form = await req.formData().catch(() => null)
  if (!form) return bad('Invalid form data.')

  const file = form.get('file')
  const notes = String(form.get('notes') || '').trim() || null
  const category = normalizeCategory(String(form.get('category') || ''))
  if (!(file instanceof File)) return bad('פייל פעלט.')

  const filename = String(file.name || 'upload.bin')
  const contentType = String(file.type || 'application/octet-stream')
  const arrayBuf = await file.arrayBuffer()
  const raw = Buffer.from(arrayBuf)
  const digest = sha256(raw)

  // Encrypt before upload (so the bytes are never stored in Supabase unencrypted by us).
  const enc = encryptBytes(raw)
  const encBytes = Buffer.from(JSON.stringify(enc), 'utf8')
  const path = `vault/${category || DEFAULT_CATEGORY}/${digest}/${Date.now()}-${filename}.enc.json`

  // Upload to Supabase Storage
  const uploaded = await (admin as any).storage.from(BUCKET).upload(path, encBytes, {
    contentType: 'application/json',
    upsert: false,
  })
  if (uploaded?.error) return bad('מען האט נישט געקענט אפלאודן דעם פייל.', 500)

  const { data, error } = await admin
    .from('unity_knowledge_assets')
    .insert({
      filename,
      content_type: contentType,
      size_bytes: raw.length,
      sha256: digest,
      storage_bucket: BUCKET,
      storage_path: path,
      encrypted: true,
      notes,
    } as any)
    .select('*')
    .maybeSingle()
  if (error) return bad('מען האט נישט געקענט זאווען metadata.', 500)

  return NextResponse.json({ ok: true, row: data }, { headers: { 'Cache-Control': 'no-store' } })
}


