import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { dataPath, ensureDataDir } from '@/lib/server-paths'

export const runtime = 'nodejs'

type InsuranceLine = 'home' | 'car' | 'life'
type CaseStatus = 'pending' | 'sent' | 'won' | 'lost'

export type NegotiationCase = {
  id: string
  line: InsuranceLine
  provider_name?: string | null
  est_monthly_savings?: number | null
  status: CaseStatus
  created_at: string
  updated_at: string
  notes?: string | null
}

const STORE_KEY = 'uc:negotiator:cases:v1'
const FILE = dataPath('negotiator_cases.json')

function nowIso() {
  return new Date().toISOString()
}

function hashId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 18)
}

async function readStore(): Promise<NegotiationCase[]> {
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', STORE_KEY]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeStore(items: NegotiationCase[]) {
  const data = JSON.stringify(items.slice(0, 500), null, 2)
  if (upstashEnabled()) {
    await upstashCmd(['SET', STORE_KEY, data]).catch(() => null)
    return
  }
  await ensureDataDir()
  await fs.writeFile(FILE, data, 'utf8')
}

function safeLine(raw: any): InsuranceLine {
  return raw === 'car' ? 'car' : raw === 'life' ? 'life' : 'home'
}

function safeStatus(raw: any): CaseStatus {
  const s = String(raw || '').toLowerCase()
  if (s === 'sent' || s === 'won' || s === 'lost') return s
  return 'pending'
}

function safeNum(raw: any): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(n, 1_000_000)
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const items = await readStore()

  const cases = items
    .filter((c) => c && typeof c === 'object' && typeof (c as any).id === 'string')
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))

  const pending = cases.filter((c) => c.status === 'pending' || c.status === 'sent')
  const pending_home = pending.filter((c) => c.line === 'home')
  const pending_car = pending.filter((c) => c.line === 'car')
  const pending_life = pending.filter((c) => c.line === 'life')
  const sum = (arr: NegotiationCase[]) => arr.reduce((acc, c) => acc + (Number(c.est_monthly_savings) || 0), 0)

  return NextResponse.json({
    ok: true,
    cases,
    totals: {
      pending_monthly_home: sum(pending_home),
      pending_monthly_car: sum(pending_car),
      pending_monthly_life: sum(pending_life),
      pending_monthly_total: sum(pending),
      counts: {
        total: cases.length,
        pending: pending.length,
        pending_home: pending_home.length,
        pending_car: pending_car.length,
        pending_life: pending_life.length,
      },
    },
    updated_at: nowIso(),
  })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const action = String(body?.action || 'create')
  const items = await readStore()

  if (action === 'update_status') {
    const id = sanitizeInput(String(body?.id || '')).trim()
    const status = safeStatus(body?.status)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const next = items.map((c) => (c.id === id ? { ...c, status, updated_at: nowIso() } : c))
    await writeStore(next)
    return NextResponse.json({ ok: true })
  }

  if (action === 'update_estimate') {
    const id = sanitizeInput(String(body?.id || '')).trim()
    const est = safeNum(body?.est_monthly_savings)
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const next = items.map((c) => (c.id === id ? { ...c, est_monthly_savings: est, updated_at: nowIso() } : c))
    await writeStore(next)
    return NextResponse.json({ ok: true })
  }

  // create
  const line = safeLine(body?.line)
  const provider_name = sanitizeInput(String(body?.provider_name || '')).trim()
  const est = safeNum(body?.est_monthly_savings)
  const notes = sanitizeInput(String(body?.notes || '')).trim()

  const id = hashId([line, provider_name || '-', nowIso(), String(Math.random())])
  const created_at = nowIso()
  const c: NegotiationCase = {
    id,
    line,
    provider_name: provider_name || null,
    est_monthly_savings: est,
    status: 'pending',
    created_at,
    updated_at: created_at,
    notes: notes || null,
  }

  await writeStore([c, ...items].slice(0, 500))
  return NextResponse.json({ ok: true, case: c })
}


