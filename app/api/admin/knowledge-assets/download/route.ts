import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { decryptBytes, vaultEncryptionEnabled, type EncBlob } from '@/lib/vault'

export const runtime = 'nodejs'

const BUCKET = 'unity-knowledge'

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return bad('נישט ערלויבט', 401)

  const admin = createAdminClient()
  if (!admin) return bad('סיסטעם קאנפיגוראציע פעלט (SUPABASE_SERVICE_ROLE_KEY).', 500)
  if (!vaultEncryptionEnabled()) return bad('קאנפיגוראציע פעלט (UNITY_VAULT_ENC_KEY).', 500)

  const id = String(req.nextUrl.searchParams.get('id') || '').trim()
  if (!id) return bad('Missing id.')

  const { data, error } = await admin.from('unity_knowledge_assets').select('*').eq('id', id).limit(1).maybeSingle()
  if (error || !data) return bad('Asset not found.', 404)

  const bucket = String((data as any)?.storage_bucket || BUCKET)
  const storagePath = String((data as any)?.storage_path || '')
  const filename = String((data as any)?.filename || 'download.bin')
  const contentType = String((data as any)?.content_type || 'application/octet-stream')

  if (!storagePath) return bad('Missing storage_path.', 500)

  const downloaded = await (admin as any).storage.from(bucket).download(storagePath)
  if (downloaded?.error) return bad('מען האט נישט געקענט אראפנעמען דעם פייל.', 500)

  const blob = downloaded?.data as Blob | null
  if (!blob) return bad('Missing bytes.', 500)

  const buf = Buffer.from(await blob.arrayBuffer())

  // Bytes in storage are encrypted JSON (EncBlob) created by `encryptBytes()`.
  let enc: EncBlob
  try {
    enc = JSON.parse(buf.toString('utf8')) as EncBlob
  } catch {
    return bad('Encrypted payload is invalid JSON.', 500)
  }

  let dec: Buffer
  try {
    dec = decryptBytes(enc)
  } catch (e: any) {
    return bad(String(e?.message || 'Decrypt failed'), 500)
  }

  return new NextResponse(dec as any, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-store, private',
    },
  })
}


