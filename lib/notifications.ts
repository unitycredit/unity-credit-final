import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type NotificationKind = 'deal' | 'bill_ready' | 'negotiator_ready'

export type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  body?: string | null
  created_at: string
  // Optional payload for UI
  deal?: {
    store: string
    title: string
    url: string
    discount_pct: number
    price?: number | null
    prev_price?: number | null
    savings_amount?: number | null
    price_crash?: boolean
  } | null
  meta?: Record<string, any>
}

export type GlobalNotificationsDB = {
  v: 1
  updated_at: string
  items: NotificationItem[]
}

const KEY = 'uc:notif:global:v1'
const FILE = path.join(process.cwd(), '.data', 'notifications_global.json')

function nowIso() {
  return new Date().toISOString()
}

export function emptyGlobalNotifications(): GlobalNotificationsDB {
  return { v: 1, updated_at: nowIso(), items: [] }
}

export async function readGlobalNotifications(): Promise<GlobalNotificationsDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) return parsed as GlobalNotificationsDB
      } catch {
        // ignore
      }
    }
    return emptyGlobalNotifications()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) return parsed as GlobalNotificationsDB
    return emptyGlobalNotifications()
  } catch {
    return emptyGlobalNotifications()
  }
}

export async function writeGlobalNotifications(db: GlobalNotificationsDB) {
  const safe: GlobalNotificationsDB = { v: 1, updated_at: nowIso(), items: Array.isArray(db?.items) ? db.items : [] }
  const payload = JSON.stringify(safe, null, 2)
  if (upstashEnabled()) {
    await upstashCmd(['SET', KEY, payload]).catch(() => null)
    return { ok: true as const, storage: 'redis' as const }
  }
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, payload, 'utf8')
  return { ok: true as const, storage: 'file' as const }
}

export function appendGlobal(db: GlobalNotificationsDB, item: NotificationItem, opts?: { max?: number }) {
  const max = Math.max(50, Math.min(1000, Number(opts?.max || 400)))
  const items = [item, ...(Array.isArray(db.items) ? db.items : [])]
  // Dedupe by id
  const seen = new Set<string>()
  const deduped: NotificationItem[] = []
  for (const it of items) {
    if (!it?.id) continue
    if (seen.has(it.id)) continue
    seen.add(it.id)
    deduped.push(it)
    if (deduped.length >= max) break
  }
  return { ...db, updated_at: nowIso(), items: deduped }
}


