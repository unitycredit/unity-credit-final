import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type SpecialsLocation = 'williamsburg' | 'boro_park' | 'monsey' | 'lakewood'
export type SpecialsStore = 'Evergreen' | 'Bingo Wholesale' | 'Rockland Kosher' | 'NPGS' | 'Pomegranate' | 'Seasons'

export type WeeklySpecial = {
  id: string
  location: SpecialsLocation
  store: SpecialsStore
  item: string
  unit?: string | null // e.g. lb, each, pack
  price: number
  size?: string | null // e.g. 5 lb bag
  starts_on?: string | null // YYYY-MM-DD
  ends_on?: string | null // YYYY-MM-DD
  notes?: string | null
  source?: string | null // URL or note
  created_at: string
  updated_at: string
  archived_at?: string | null // soft delete
}

export type WeeklySpecialsDB = {
  v: 1
  updated_at: string
  specials: WeeklySpecial[]
}

const KEY = 'uc:specials:weekly:v1'
const FILE = path.join(process.cwd(), '.data', 'weekly_specials.json')

function nowIso() {
  return new Date().toISOString()
}

function makeId() {
  return `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyWeeklySpecialsDB(): WeeklySpecialsDB {
  return { v: 1, updated_at: nowIso(), specials: [] }
}

export async function readWeeklySpecialsDB(): Promise<WeeklySpecialsDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.specials)) return parsed as WeeklySpecialsDB
      } catch {
        // ignore
      }
    }
    return emptyWeeklySpecialsDB()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.specials)) return parsed as WeeklySpecialsDB
    return emptyWeeklySpecialsDB()
  } catch {
    return emptyWeeklySpecialsDB()
  }
}

export async function writeWeeklySpecialsDB(next: WeeklySpecialsDB) {
  const safe: WeeklySpecialsDB = { v: 1, updated_at: nowIso(), specials: Array.isArray(next?.specials) ? next.specials : [] }
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

export function addWeeklySpecial(db: WeeklySpecialsDB, input: Omit<WeeklySpecial, 'id' | 'created_at' | 'updated_at'>) {
  const ts = nowIso()
  const row: WeeklySpecial = { ...input, id: makeId(), created_at: ts, updated_at: ts }
  return { ...db, updated_at: ts, specials: [row, ...(db.specials || [])] }
}

export function archiveWeeklySpecial(db: WeeklySpecialsDB, id: string) {
  const ts = nowIso()
  const specials = (db.specials || []).map((s) => (s.id === id ? { ...s, archived_at: ts, updated_at: ts } : s))
  return { ...db, updated_at: ts, specials }
}

export function activeSpecials(db: WeeklySpecialsDB) {
  return (db.specials || []).filter((s) => !s.archived_at)
}


