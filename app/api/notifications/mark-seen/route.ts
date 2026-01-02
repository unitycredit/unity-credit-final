import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export const runtime = 'nodejs'

type SeenDB = { v: 1; updated_at: string; by_client: Record<string, { seen: Record<string, boolean>; updated_at: string }> }

const FILE = path.join(process.cwd(), '.data', 'notifications_seen.json')

function nowIso() {
  return new Date().toISOString()
}

async function readSeenDB(): Promise<SeenDB> {
  if (upstashEnabled()) {
    // For Redis we store each client key separately to avoid a large global blob.
    return { v: 1, updated_at: nowIso(), by_client: {} }
  }
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && parsed.by_client && typeof parsed.by_client === 'object') return parsed as SeenDB
    return { v: 1, updated_at: nowIso(), by_client: {} }
  } catch {
    return { v: 1, updated_at: nowIso(), by_client: {} }
  }
}

async function writeSeenDB(db: SeenDB) {
  if (upstashEnabled()) return
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), 'utf8')
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any
  const client_id = sanitizeInput(String(body?.client_id || '')).trim().slice(0, 80)
  const idsRaw = body?.ids
  const ids = Array.isArray(idsRaw) ? idsRaw.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 200) : []
  if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
  if (!ids.length) return NextResponse.json({ ok: true, updated: 0 })

  const ts = nowIso()

  if (upstashEnabled()) {
    const key = `uc:notif:seen:${client_id}`
    // Merge seen flags (best-effort)
    const resp = await upstashCmd<string>(['GET', key]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    let seen: Record<string, boolean> = {}
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') seen = parsed
      } catch {
        seen = {}
      }
    }
    for (const id of ids) seen[id] = true
    await upstashCmd(['SETEX', key, 60 * 60 * 24 * 30, JSON.stringify(seen)]).catch(() => null) // 30d
    return NextResponse.json({ ok: true, updated: ids.length, storage: 'redis' })
  }

  const db = await readSeenDB()
  const entry = db.by_client[client_id] || { seen: {}, updated_at: ts }
  for (const id of ids) entry.seen[id] = true
  entry.updated_at = ts
  db.by_client[client_id] = entry
  db.updated_at = ts
  await writeSeenDB(db)
  return NextResponse.json({ ok: true, updated: ids.length, storage: 'file' })
}


