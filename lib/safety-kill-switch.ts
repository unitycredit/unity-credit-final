import { promises as fs } from 'node:fs'
import path from 'node:path'
import { upstashCmd, upstashEnabled } from '@/lib/upstash'

export type SafetyKillSwitchState = {
  v: 1
  paused: boolean
  updated_at: string
  paused_at?: string | null
  resumed_at?: string | null
  reason?: string | null
  meta?: Record<string, any> | null
}

const KEY = 'uc:safety:kill_switch:v1'
const FILE = path.join(process.cwd(), '.data', 'kill_switch.json')

function nowIso() {
  return new Date().toISOString()
}

export function defaultKillSwitchState(): SafetyKillSwitchState {
  return { v: 1, paused: false, updated_at: nowIso(), paused_at: null, resumed_at: null, reason: null, meta: null }
}

async function readFromRedis(): Promise<SafetyKillSwitchState | null> {
  const resp = await upstashCmd<string>(['GET', KEY]).catch(() => null)
  const raw = String((resp as any)?.result || '')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v === 1 && typeof parsed?.paused === 'boolean') return parsed as SafetyKillSwitchState
  } catch {
    // ignore
  }
  return null
}

async function writeToRedis(next: SafetyKillSwitchState) {
  await upstashCmd(['SET', KEY, JSON.stringify(next)]).catch(() => null)
}

async function readFromFile(): Promise<SafetyKillSwitchState | null> {
  try {
    const raw = await fs.readFile(FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.v === 1 && typeof parsed?.paused === 'boolean') return parsed as SafetyKillSwitchState
  } catch {
    // ignore
  }
  return null
}

async function writeToFile(next: SafetyKillSwitchState) {
  const dir = path.join(process.cwd(), '.data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(FILE, JSON.stringify(next, null, 2), 'utf8')
}

export async function readSafetyKillSwitch() {
  if (upstashEnabled()) {
    const fromRedis = await readFromRedis()
    return { state: fromRedis || defaultKillSwitchState(), storage: 'redis' as const }
  }
  const fromFile = await readFromFile()
  return { state: fromFile || defaultKillSwitchState(), storage: 'file' as const }
}

export async function pauseSafetyKillSwitch(reason: string, meta?: Record<string, any>) {
  const { state } = await readSafetyKillSwitch()
  const next: SafetyKillSwitchState = {
    ...state,
    v: 1,
    paused: true,
    updated_at: nowIso(),
    paused_at: state.paused_at || nowIso(),
    reason: String(reason || 'paused').trim() || 'paused',
    meta: meta || null,
  }

  if (upstashEnabled()) await writeToRedis(next)
  else await writeToFile(next)

  return next
}

export async function resumeSafetyKillSwitch(meta?: Record<string, any>) {
  const { state } = await readSafetyKillSwitch()
  const next: SafetyKillSwitchState = {
    ...state,
    v: 1,
    paused: false,
    updated_at: nowIso(),
    resumed_at: nowIso(),
    reason: null,
    meta: meta || null,
  }

  if (upstashEnabled()) await writeToRedis(next)
  else await writeToFile(next)

  return next
}


