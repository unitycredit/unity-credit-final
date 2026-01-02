import { promises as fs } from 'node:fs'
import path from 'node:path'

export type SavingsEmailSubscriber = {
  user_id: string
  email: string
  subscribed_at: string
  last_sent_ym?: string | null
}

type DB = {
  v: 1
  updated_at: string
  subscribers: Record<string, SavingsEmailSubscriber>
}

const FILE = path.join(process.cwd(), '.data', 'savings_email_subscribers.json')

function nowIso() {
  return new Date().toISOString()
}

function empty(): DB {
  return { v: 1, updated_at: nowIso(), subscribers: {} }
}

export async function readSavingsSubscribers(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && parsed.subscribers && typeof parsed.subscribers === 'object') return parsed as DB
    return empty()
  } catch {
    return empty()
  }
}

export async function writeSavingsSubscribers(db: DB) {
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  const safe: DB = {
    v: 1,
    updated_at: nowIso(),
    subscribers: db?.subscribers && typeof db.subscribers === 'object' ? db.subscribers : {},
  }
  await fs.writeFile(FILE, JSON.stringify(safe, null, 2), 'utf8')
  return { ok: true as const }
}


