import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type LogicJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type LogicJob = {
  id: string
  user_id: string
  status: LogicJobStatus
  created_at: string
  updated_at: string
  question: string
  context: any
  result?: any
  error?: string
}

const PREFIX = 'uc:logic:job:v1:'
const QUEUE = 'uc:logic:queue:v1'
const TTL_SECONDS = 60 * 60 // 1 hour (workers can extend by re-setting)

function nowIso() {
  return new Date().toISOString()
}

export function logicJobsEnabled() {
  return upstashEnabled()
}

export async function createLogicJob(input: { question: string; context: any }): Promise<LogicJob> {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`
  const userId = String((input as any)?.user_id || '').trim()
  if (!userId) throw new Error('Missing user_id')
  const job: LogicJob = {
    id,
    user_id: userId,
    status: 'queued',
    created_at: nowIso(),
    updated_at: nowIso(),
    question: input.question,
    context: input.context,
  }
  if (!upstashEnabled()) throw new Error('Logic jobs require Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN).')
  await upstashCmd(['SETEX', `${PREFIX}${id}`, TTL_SECONDS, JSON.stringify(job)]).catch(() => null)
  await upstashCmd(['LPUSH', QUEUE, id]).catch(() => null)
  return job
}

export async function readLogicJob(id: string): Promise<LogicJob | null> {
  if (!upstashEnabled()) return null
  const resp = await upstashCmd<string>(['GET', `${PREFIX}${id}`]).catch(() => null)
  const raw = String((resp as any)?.result || '')
  if (!raw) return null
  try {
    return JSON.parse(raw) as LogicJob
  } catch {
    return null
  }
}

export async function updateLogicJob(id: string, patch: Partial<LogicJob>) {
  const prev = await readLogicJob(id)
  if (!prev) return null
  const next: LogicJob = { ...prev, ...patch, id: prev.id, updated_at: nowIso() }
  await upstashCmd(['SETEX', `${PREFIX}${id}`, TTL_SECONDS, JSON.stringify(next)]).catch(() => null)
  return next
}

export async function popLogicJobId(): Promise<string | null> {
  if (!upstashEnabled()) return null
  const resp = await upstashCmd<string>(['RPOP', QUEUE]).catch(() => null)
  const id = String((resp as any)?.result || '').trim()
  return id || null
}


