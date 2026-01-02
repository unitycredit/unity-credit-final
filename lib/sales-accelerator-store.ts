import 'server-only'
import { promises as fs } from 'node:fs'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { dataPath, ensureDataDir } from '@/lib/server-paths'
import type { SalesAcceleratorResult } from '@/lib/sales-accelerator'

const KEY = 'uc:brain:vault:business_sales_accelerator:v1'
const FILE = dataPath('business_sales_accelerator_latest.json')

function empty(): SalesAcceleratorResult {
  return {
    ok: true,
    mode: 'offline',
    updated_at: new Date().toISOString(),
    category: 'Business-Sales-Accelerator',
    keywords: 'b2b',
    opportunities: [],
    note: 'Empty store.',
  }
}

export async function readSalesAcceleratorLatest(): Promise<SalesAcceleratorResult> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (raw) {
      try {
        return JSON.parse(raw) as SalesAcceleratorResult
      } catch {
        return empty()
      }
    }
    return empty()
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    return JSON.parse(raw) as SalesAcceleratorResult
  } catch {
    return empty()
  }
}

export async function writeSalesAcceleratorLatest(next: SalesAcceleratorResult) {
  const safe = { ...(next || empty()), updated_at: new Date().toISOString() } as SalesAcceleratorResult
  const payload = JSON.stringify(safe, null, 2)

  if (upstashEnabled()) {
    await upstashCmd(['SETEX', KEY, 60 * 60, payload]).catch(() => null) // 1h
    return { ok: true as const, storage: 'redis' as const }
  }

  await ensureDataDir()
  await fs.writeFile(FILE, payload, 'utf8')
  return { ok: true as const, storage: 'file' as const }
}


