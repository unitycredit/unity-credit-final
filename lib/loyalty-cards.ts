import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type LoyaltyCardKey = 'evercard' | 'bingo_membership' | 'target_redcard'

export type LoyaltyCard = {
  key: LoyaltyCardKey
  label: string
  points?: number | null
  member_id_last4?: string | null
  notes?: string | null
  updated_at: string
}

export type LoyaltyDB = {
  v: 1
  updated_at: string
  cards: LoyaltyCard[]
}

const KEY = 'uc:loyalty:cards:v1'
const FILE = path.join(process.cwd(), '.data', 'loyalty_cards.json')

function nowIso() {
  return new Date().toISOString()
}

export function defaultLoyaltyDB(): LoyaltyDB {
  const ts = nowIso()
  return {
    v: 1,
    updated_at: ts,
    cards: [
      { key: 'evercard', label: 'Evercard', points: null, member_id_last4: null, notes: null, updated_at: ts },
      { key: 'bingo_membership', label: 'Bingo Membership', points: null, member_id_last4: null, notes: null, updated_at: ts },
      { key: 'target_redcard', label: 'Target RedCard', points: null, member_id_last4: null, notes: 'Benefit is typically % savings vs points.', updated_at: ts },
    ],
  }
}

export async function readLoyaltyDB(): Promise<LoyaltyDB> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.v === 1 && Array.isArray(parsed.cards)) return parsed as LoyaltyDB
      } catch {
        // ignore
      }
    }
    return defaultLoyaltyDB()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && Array.isArray(parsed.cards)) return parsed as LoyaltyDB
    return defaultLoyaltyDB()
  } catch {
    return defaultLoyaltyDB()
  }
}

export async function writeLoyaltyDB(next: LoyaltyDB) {
  const safe: LoyaltyDB = {
    v: 1,
    updated_at: nowIso(),
    cards: Array.isArray(next?.cards) ? next.cards : [],
  }
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

export function upsertCard(db: LoyaltyDB, patch: Partial<LoyaltyCard> & { key: LoyaltyCardKey }) {
  const cards = Array.isArray(db.cards) ? [...db.cards] : []
  const idx = cards.findIndex((c) => c.key === patch.key)
  const existing = idx >= 0 ? cards[idx] : null
  const updated: LoyaltyCard = {
    key: patch.key,
    label: String(patch.label || existing?.label || patch.key),
    points: patch.points ?? existing?.points ?? null,
    member_id_last4: patch.member_id_last4 ?? existing?.member_id_last4 ?? null,
    notes: patch.notes ?? existing?.notes ?? null,
    updated_at: nowIso(),
  }
  if (idx >= 0) cards[idx] = updated
  else cards.push(updated)
  return { ...db, updated_at: nowIso(), cards }
}


