import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { encryptJson, vaultEncryptionEnabled, type EncBlob } from '@/lib/unity-brain/vault'
import { sanitizeConsensusTrailEntry } from '@/lib/unity-brain/sanitize'

export type BrainInteractionKind = 'chat' | 'decision'

export type BrainInteraction = {
  id: string
  created_at: string
  kind: BrainInteractionKind
  user_id: string | null
  request_id: string | null
  source: 'dashboard' | 'api' | 'system'
  // Encrypted JSON blob (vault AES-256-GCM)
  encrypted_payload: EncBlob
  // Non-sensitive metadata for indexing
  meta: {
    question_hash?: string
    route?: string
    ok?: boolean
    blocked?: boolean
  }
}

const FILE_PATH = path.join(process.cwd(), '.data', 'brain_interactions.enc.jsonl')

function sha256Hex(s: string) {
  return createHash('sha256').update(String(s || ''), 'utf8').digest('hex')
}

function safeId() {
  return `bi_${Date.now()}_${randomUUID().replace(/-/g, '')}`.slice(0, 60)
}

async function appendToFile(row: BrainInteraction) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true })
  await fs.appendFile(FILE_PATH, JSON.stringify(row) + '\n', 'utf8')
}

export async function persistBrainInteraction(params: {
  kind: BrainInteractionKind
  source: BrainInteraction['source']
  user_id?: string | null
  request_id?: string | null
  route?: string | null
  question?: string | null
  payload: any
  ok?: boolean
  blocked?: boolean
}) {
  // If vault encryption is not configured, we refuse to persist (security-first).
  // (Callers can still log via audit trail if desired.)
  if (!vaultEncryptionEnabled()) return { ok: false as const, persisted: false as const, reason: 'vault_disabled' as const }

  const now = new Date().toISOString()
  const id = safeId()
  const q = String(params.question || '').trim()
  const question_hash = q ? sha256Hex(q).slice(0, 32) : undefined

  // Sanitize payload before encrypting (defense-in-depth: prevents internal/vendor leakage).
  const sanitized = sanitizeConsensusTrailEntry(params.payload)

  const aad = `unity_brain_interaction:v1:${params.kind}:${params.source}:${params.user_id || 'anon'}:${params.request_id || id}`
  const encrypted_payload = encryptJson(sanitized, { aad })

  const row: BrainInteraction = {
    id,
    created_at: now,
    kind: params.kind,
    user_id: params.user_id || null,
    request_id: params.request_id || null,
    source: params.source,
    encrypted_payload,
    meta: {
      question_hash,
      route: params.route ? String(params.route) : undefined,
      ok: typeof params.ok === 'boolean' ? params.ok : undefined,
      blocked: typeof params.blocked === 'boolean' ? params.blocked : undefined,
    },
  }

  // Prefer DB when configured; fall back to encrypted file for dev.
  const admin = createAdminClient()
  if (admin) {
    try {
      // Table name is intentionally simple; if missing, we fall back to file (dev-friendly).
      const { error } = await admin.from('unity_brain_interactions').insert({
        id: row.id,
        created_at: row.created_at,
        kind: row.kind,
        user_id: row.user_id,
        request_id: row.request_id,
        source: row.source,
        encrypted_payload: row.encrypted_payload as any,
        meta: row.meta as any,
      } as any)
      if (!error) return { ok: true as const, persisted: true as const, storage: 'supabase' as const }
    } catch {
      // fall through
    }
  }

  await appendToFile(row).catch(() => null)
  return { ok: true as const, persisted: true as const, storage: 'file' as const }
}


