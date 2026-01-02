import { promises as fs } from 'node:fs'
import path from 'node:path'

export type SubscriberRecord = {
  user_id: string
  created_at?: string | null
  premium_active: boolean
  premium_until?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  total_paid_cents?: number | null
  trial_active?: boolean
  trial_until?: string | null
}

export type PaymentRecord = {
  id: string
  ts: string
  user_id?: string | null
  amount_cents: number
  status?: string | null
  meta?: any
}

export type BillingDB = {
  v: 1
  updated_at: string
  subscribers: Record<string, SubscriberRecord>
  payments: PaymentRecord[]
}

const FILE = path.join(process.cwd(), '.data', 'billing_store.json')

function nowIso() {
  return new Date().toISOString()
}

export function emptyBilling(): BillingDB {
  return { v: 1, updated_at: nowIso(), subscribers: {}, payments: [] }
}

export async function readBilling(): Promise<BillingDB> {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.v === 1 && parsed.subscribers && parsed.payments) return parsed as BillingDB
    return emptyBilling()
  } catch {
    return emptyBilling()
  }
}

export async function writeBilling(db: BillingDB) {
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  const safe: BillingDB = {
    v: 1,
    updated_at: nowIso(),
    subscribers: db?.subscribers && typeof db.subscribers === 'object' ? db.subscribers : {},
    payments: Array.isArray(db?.payments) ? db.payments : [],
  }
  await fs.writeFile(FILE, JSON.stringify(safe, null, 2), 'utf8')
  return { ok: true as const }
}

export async function readPaymentTail(limit = 200): Promise<PaymentRecord[]> {
  const db = await readBilling()
  const tail = (db.payments || []).slice(-Math.max(1, Math.min(1000, Number(limit) || 200)))
  return tail
}


