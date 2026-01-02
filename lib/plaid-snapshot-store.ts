import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

const KEY = 'uc:plaid:latest'
const FILE = path.join(process.cwd(), '.data', 'plaid_latest.json')

export type PlaidLatestSnapshot = {
  updated_at: string
  results: any[]
}

export async function readPlaidLatestSnapshot(): Promise<PlaidLatestSnapshot | null> {
  // Redis preferred for multi-instance deployments.
  if (upstashEnabled()) {
    const cached = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((cached as any)?.result || '')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.results)) return parsed as PlaidLatestSnapshot
      } catch {
        // ignore
      }
    }
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.results)) return parsed as PlaidLatestSnapshot
    return null
  } catch {
    return null
  }
}

export async function writePlaidLatestSnapshot(snapshot: PlaidLatestSnapshot) {
  const safe: PlaidLatestSnapshot = {
    updated_at: String(snapshot?.updated_at || new Date().toISOString()),
    results: Array.isArray(snapshot?.results) ? snapshot.results : [],
  }

  const payload = JSON.stringify(safe, null, 2)

  if (upstashEnabled()) {
    // Keep a rolling snapshot for reads; we refresh frequently so TTL is fine.
    await upstashCmd(['SETEX', KEY, 60 * 30, payload]).catch(() => null) // 30 minutes
  }

  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, payload, 'utf8')
  return { ok: true as const }
}


