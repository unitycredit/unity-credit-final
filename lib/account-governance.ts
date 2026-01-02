import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '@/lib/supabase-admin'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type AccountType = 'personal' | 'institution' | 'business_overhead'

export type AccountGovernanceStatus = {
  ok: boolean
  user_id: string | null
  email: string | null
  account_type: AccountType | null
  blocked: boolean
  blocked_at: string | null
  blocked_reason: string | null
}

type BlockRecord = {
  user_id: string
  blocked_at: string
  blocked_reason: string
}

const BLOCKS_FILE = path.join(process.cwd(), '.data', 'account_blocks.json')
const UPSTASH_BLOCKS_KEY = 'uc:governance:blocked:v1'

async function readBlocksFallback(): Promise<Record<string, BlockRecord>> {
  try {
    const raw = await fs.readFile(BLOCKS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as any) : {}
  } catch {
    return {}
  }
}

async function writeBlocksFallback(map: Record<string, BlockRecord>) {
  try {
    const dir = path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(BLOCKS_FILE, JSON.stringify(map, null, 2), 'utf8')
  } catch {
    // ignore
  }
}

export async function getAccountGovernanceStatus(req: NextRequest): Promise<AccountGovernanceStatus> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return {
        ok: false,
        user_id: null,
        email: null,
        account_type: null,
        blocked: false,
        blocked_at: null,
        blocked_reason: null,
      }
    }

    const { data: profile, error } = await supabase.from('users').select('account_type,blocked_at,blocked_reason').eq('id', user.id).maybeSingle()

    // If schema isn't migrated yet, don't break auth flows; use fallback block store when available.
    if (error) {
      const fb = await readBlocksFallback()
      const rec = fb[user.id] || null
      return {
        ok: true,
        user_id: user.id,
        email: user.email || null,
        account_type: null,
        blocked: Boolean(rec?.blocked_at),
        blocked_at: rec?.blocked_at || null,
        blocked_reason: rec?.blocked_reason || null,
      }
    }

    const account_type = String((profile as any)?.account_type || '').trim() as AccountType
    const blocked_at = String((profile as any)?.blocked_at || '').trim() || null
    const blocked_reason = String((profile as any)?.blocked_reason || '').trim() || null
    return {
      ok: true,
      user_id: user.id,
      email: user.email || null,
      account_type: account_type === 'personal' || account_type === 'institution' || account_type === 'business_overhead' ? account_type : null,
      blocked: Boolean(blocked_at),
      blocked_at,
      blocked_reason,
    }
  } catch {
    return {
      ok: false,
      user_id: null,
      email: null,
      account_type: null,
      blocked: false,
      blocked_at: null,
      blocked_reason: null,
    }
  }
}

export function detectBusinessInventoryPattern(transactions: any[]): { flagged: boolean; score: number; reasons: string[] } {
  const txs = Array.isArray(transactions) ? transactions : []
  let score = 0
  const reasons: string[] = []

  const inventoryKeywords = [
    'wholesale',
    'wholesaler',
    'distribution',
    'distributor',
    'restaurant depot',
    'supply',
    'supplies',
    'inventory',
    'packaging',
    'boxes',
    'labels',
    'bulk',
    'import',
    'customs',
    'freight',
    'fulfillment',
    'warehouse',
    'u line',
    'uline',
  ]

  let invCount = 0
  let invSpend = 0
  let highTicketCount = 0

  for (const t of txs) {
    const amt = Number((t as any)?.amount) || 0
    if (!(amt > 0)) continue
    const merchant = String((t as any)?.merchant_name || (t as any)?.name || '').toLowerCase()
    const name = String((t as any)?.name || '').toLowerCase()
    const text = `${merchant} ${name}`.trim()
    if (!text) continue

    const hit = inventoryKeywords.some((k) => text.includes(k))
    if (hit) {
      invCount += 1
      invSpend += amt
      if (amt >= 450) highTicketCount += 1
    }
  }

  if (invCount >= 3) {
    score += 2
    reasons.push(`Inventory-like merchants detected (${invCount} tx)`)
  }
  if (invSpend >= 1200) {
    score += 2
    reasons.push(`Inventory-like spend over $${Math.round(invSpend)} in window`)
  }
  if (highTicketCount >= 2) {
    score += 1
    reasons.push(`Multiple high-ticket inventory-like purchases (${highTicketCount})`)
  }

  return { flagged: score >= 3, score, reasons }
}

// Lightweight intent detector for Unity Credit requests (text-only). This complements transaction-based detection.
export function detectBusinessInventoryIntentFromText(text: string): { flagged: boolean; reasons: string[] } {
  const s = String(text || '').toLowerCase()
  const reasons: string[] = []
  if (!s.trim()) return { flagged: false, reasons }

  const inventoryWords = ['inventory', 'wholesale', 'bulk', 'supplier', 'distribution', 'warehouse', 'fulfillment', 'fba', 'reseller']
  const resellWords = ['resell', 'reselling', 'flip', 'flipping', 'arbitrage', 'scalp', 'scalping']
  const businessWords = ['business', 'store', 'shop', 'my customers', 'for customers', 'for resale', 'resale', 'for my store']

  const hasInventory = inventoryWords.some((w) => s.includes(w))
  const hasResell = resellWords.some((w) => s.includes(w))
  const hasBusiness = businessWords.some((w) => s.includes(w))

  // Only flag when the user is asking for resale/business-inventory guidance (not normal household bulk shopping).
  if ((hasResell && (hasInventory || hasBusiness)) || (hasInventory && hasBusiness && s.includes('resale'))) {
    reasons.push('Business inventory / resale intent detected')
    if (hasResell) reasons.push('Contains resale/arbitrage language')
    if (hasInventory) reasons.push('Contains inventory/wholesale language')
    if (hasBusiness) reasons.push('Contains business/customer language')
    return { flagged: true, reasons }
  }
  return { flagged: false, reasons }
}

export async function setAccountBlocked(params: {
  user_id: string
  blocked_reason: string
  blocked_at?: string
}) {
  const user_id = String(params.user_id || '').trim()
  if (!user_id) return { ok: false as const, error: 'Missing user_id' }
  const blocked_at = String(params.blocked_at || new Date().toISOString())
  const blocked_reason = String(params.blocked_reason || '').trim() || 'Policy violation'

  // Persist to Supabase (preferred) when service role is configured.
  const admin = createAdminClient()
  if (admin) {
    try {
      await admin
        .from('users')
        .update({ blocked_at, blocked_reason })
        .eq('id', user_id)
      // Mirror to Upstash for fast checks (best-effort)
      if (upstashEnabled()) {
        await upstashCmd(['HSET', UPSTASH_BLOCKS_KEY, user_id, JSON.stringify({ user_id, blocked_at, blocked_reason })]).catch(() => null)
      }
      return { ok: true as const, storage: 'supabase' as const }
    } catch {
      // fall through to file
    }
  }

  // Fallback to local file (dev-friendly)
  const fb = await readBlocksFallback()
  fb[user_id] = { user_id, blocked_at, blocked_reason }
  await writeBlocksFallback(fb)
  return { ok: true as const, storage: 'file' as const }
}

export async function queueGovernanceBlockedEmail(params: { to: string; user_id: string; account_type: AccountType | null; reason: string }) {
  const to = String(params.to || '').trim()
  if (!to || !to.includes('@')) return { ok: false as const, error: 'Missing recipient email' }
  const jobId = `gov_${String(params.user_id || '').slice(0, 12)}_${Date.now().toString(36)}`

  const subjectEn = 'Important Notice: Account Usage Violation'
  const bodyEn = `Dear Customer,

We are writing to inform you that your Unity Credit account has been temporarily restricted due to detected activity inconsistent with your selected account type.

Reason: ${String(params.reason || 'Policy violation').trim()}

If you believe this was an error, please reply to this email with a brief explanation and supporting context. Do not include sensitive documents unless requested by a verified Unity Credit representative.

Sincerely,
Unity Credit Compliance`

  const subjectYi = 'וויכטיגע מעלדונג: קאנטע־באַנוץ־איבערטרעטונג'
  const bodyYi = `שלום,

מיר מעלדן אייך אז אייער Unity Credit קאנטע איז צייַטווייליג ריסטריקטירט געווארן צוליב באמערקטע אקטיוויטעט וואס איז נישט אין לײַן מיט אייער אויסגעקליבענע קאנטע־סארט.

סיבה: ${String(params.reason || 'Policy violation').trim()}

אויב איר מיינט אז דאס איז א טעות, ביטע ענטפערט אויף דעם אימעיל מיט א קורצע דערקלערונג און באקאַנטע פרטים. ביטע שיקט נישט קיין סענסיטיווע דאקומענטן סתם אזוי.

מיט אכטונג,
Unity Credit Compliance`

  const subject = `${subjectEn} / ${subjectYi}`
  const text = `${bodyEn}\n\n---\n\n${bodyYi}`.trim()
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</div>`

  const job = {
    id: jobId,
    kind: 'raw',
    created_at: new Date().toISOString(),
    to,
    subject,
    text,
    html,
    meta: { type: 'governance_block_notice', user_id: params.user_id, account_type: params.account_type, reason: params.reason },
  }

  // Queue via Upstash when available; otherwise file fallback for dev.
  if (upstashEnabled()) {
    await upstashCmd(['LPUSH', 'uc:queue:email', JSON.stringify(job)]).catch(() => null)
    return { ok: true as const, queued: true as const, storage: 'redis' as const }
  }
  try {
    const dir = path.join(process.cwd(), '.data')
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(path.join(dir, 'email_queue.jsonl'), JSON.stringify(job) + '\n', 'utf8')
    return { ok: true as const, queued: true as const, storage: 'file' as const }
  } catch {
    return { ok: false as const, queued: false as const, error: 'Queue not available' }
  }
}


