import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

type ParsedEnv = Record<string, string>

let cached: ParsedEnv | null = null

function stripQuotes(v: string) {
  const s = String(v || '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
}

function parseEnvFile(text: string): ParsedEnv {
  const out: ParsedEnv = {}
  const lines = String(text || '').split(/\r?\n/g)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = stripQuotes(line.slice(eq + 1))
    if (!key) continue
    if (!(key in out)) out[key] = value
  }
  return out
}

function safeRead(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

function loadFallbackEnvOnce(): ParsedEnv {
  if (cached) return cached

  const root = process.cwd()
  const candidates = [
    // The user explicitly asked to use this template as a temporary credentials source.
    path.join(root, 'DOTENV_LOCAL_TEMPLATE.txt'),
    // Best-effort local override (Next already loads this, but we also read it directly for robustness).
    path.join(root, '.env.local'),
  ]

  const merged: ParsedEnv = {}
  for (const p of candidates) {
    const raw = safeRead(p)
    if (!raw) continue
    const parsed = parseEnvFile(raw)
    Object.assign(merged, parsed)
  }

  cached = merged
  return merged
}

export function getRuntimeEnvVar(name: string): string | null {
  const fromProcess = String(process.env[name] || '').trim()
  if (fromProcess) return fromProcess

  const fallback = loadFallbackEnvOnce()
  const fromFile = String(fallback[name] || '').trim()
  return fromFile || null
}

export type SupabaseRuntimeConfig = {
  url: string | null
  anonKey: string | null
  serviceRoleKey: string | null
}

function looksLikePlaceholder(v: string | null) {
  const s = String(v || '').trim()
  if (!s) return true
  // Matches the repo templates
  if (s.includes('YOUR_PROJECT_REF') || s.includes('YOUR_ANON_PUBLIC_KEY') || s.includes('YOUR_SERVICE_ROLE_KEY')) return true
  if (s === 'your_supabase_project_url' || s === 'your_supabase_anon_key' || s === 'your_supabase_service_role_key') return true
  return false
}

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig {
  // URL isn't secret; allow both SUPABASE_URL and NEXT_PUBLIC for compatibility.
  const url = getRuntimeEnvVar('SUPABASE_URL') || getRuntimeEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getRuntimeEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceRoleKey = getRuntimeEnvVar('SUPABASE_SERVICE_ROLE_KEY')

  return {
    url: looksLikePlaceholder(url) ? null : url,
    anonKey: looksLikePlaceholder(anonKey) ? null : anonKey,
    serviceRoleKey: looksLikePlaceholder(serviceRoleKey) ? null : serviceRoleKey,
  }
}


