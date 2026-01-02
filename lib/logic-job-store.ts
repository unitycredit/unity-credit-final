import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type LogicJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type LogicJobRecord = {
  id: string
  created_at: string
  status: LogicJobStatus
  user_key: string
  question: string
  context: any
  result?: any
  error?: string
  updated_at: string
}

const QUEUE_KEY = 'uc:logic:jobs:v1'

function jobKey(id: string) {
  return `uc:logic:job:${id}`
}

function nowIso() {
  return new Date().toISOString()
}

export function newJobId() {
  return `lj_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

export async function enqueueLogicJob(input: { user_key: string; question: string; context: any }) {
  const id = newJobId()
  const rec: LogicJobRecord = {
    id,
    created_at: nowIso(),
    updated_at: nowIso(),
    status: 'queued',
    user_key: input.user_key,
    question: input.question,
    context: input.context ?? {},
  }

  if (upstashEnabled()) {
    await upstashCmd(['SETEX', jobKey(id), 60 * 60, JSON.stringify(rec)]).catch(() => null) // 1h
    await upstashCmd(['LPUSH', QUEUE_KEY, id]).catch(() => null)
    return { ok: true as const, id }
  }

  // File fallback (dev only).
  const dir = path.join(process.cwd(), '.data', 'logic_jobs')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(rec, null, 2), 'utf8')
  await fs.appendFile(path.join(dir, 'queue.jsonl'), JSON.stringify({ id, at: nowIso() }) + '\n', 'utf8')
  return { ok: true as const, id }
}

export async function readLogicJob(id: string): Promise<LogicJobRecord | null> {
  if (!id) return null
  if (upstashEnabled()) {
    const resp = await upstashCmd<string>(['GET', jobKey(id)]).catch(() => null)
    const raw = String((resp as any)?.result || '')
    if (!raw) return null
    try {
      return JSON.parse(raw) as LogicJobRecord
    } catch {
      return null
    }
  }
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.data', 'logic_jobs', `${id}.json`), 'utf8')
    return JSON.parse(raw) as LogicJobRecord
  } catch {
    return null
  }
}


