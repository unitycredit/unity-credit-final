// Canonical sanitization routines for Unity Brain agents.
// - Brand guard for user-visible text
// - Redaction of internal architecture hints from logs/metadata

const MAX_TEXT_CHARS = 20_000
const DEFAULT_MAX_DEPTH = 6
const DEFAULT_MAX_ARRAY = 200
const DEFAULT_MAX_KEYS = 200

const RX = {
  // Normalize any self-referential assistant framing.
  languageModel: /\b(language model|large language model)\b/gi,
  prompt: /\b(system prompt|prompt)\b/gi,

  // Internal URLs/paths (avoid leaking architecture details).
  apiPath: /\/api\/[a-z0-9/_-]+/gi,

  // Internal infra / keywords.
  infraWords: /\b(upstash|supabase|redis|service role|service_role|admin secret|internal_job_secret)\b/gi,
  envWords: /\b(\.env(\.local)?|AUDIT_LOG_ENC_KEY|PLAID_TOKEN_ENC_KEY|UNITY_VAULT_ENC_KEY)\b/gi,

  // Common secret shapes (best-effort redaction).
  jwt: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  supabaseKey: /\bsb_(?:secret|publishable)_[a-z0-9_]{20,}\b/gi,
  stripeKey: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{10,}\b/g,
  longHex: /\b[a-f0-9]{32,}\b/gi,
}

function redactSecrets(s: string) {
  return s
    .replace(RX.jwt, '[jwt]')
    .replace(RX.supabaseKey, '[supabase_key]')
    .replace(RX.stripeKey, '[stripe_key]')
    .replace(RX.longHex, '[hex]')
}

function sanitizeText(input: any) {
  const raw = String(input ?? '')
  if (!raw) return raw

  // Important: redact common secret shapes before trimming so we don't accidentally keep only the secret portion.
  const redacted = redactSecrets(raw)

  return redacted
    .replace(RX.languageModel, 'Unity Credit')
    .replace(RX.prompt, 'internal guidance')
    .replace(RX.apiPath, '[internal]')
    .replace(RX.infraWords, '[internal]')
    .replace(RX.envWords, '[internal]')
    .trim()
    .slice(0, MAX_TEXT_CHARS) // safety cap for logs/UI
}

type DeepSanitizeOptions = {
  maxDepth: number
  maxArrayLength: number
  maxObjectKeys: number
}

function isPlainObject(v: any) {
  if (!v || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function deepSanitizeInternal(value: any, opts: DeepSanitizeOptions, depth: number, seen: WeakSet<object>): any {
  if (value === null || value === undefined) return value
  if (depth > opts.maxDepth) return '[truncated]'

  // Preserve primitives' types; only sanitize strings.
  if (typeof value === 'string') return sanitizeText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return String(value)
  if (typeof value === 'function') return '[function]'

  if (Array.isArray(value)) {
    const arr = value.slice(0, opts.maxArrayLength)
    return arr.map((v) => deepSanitizeInternal(v, opts, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[circular]'
    seen.add(value as object)

    // Preserve Dates and other "special" objects.
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Error) {
      return {
        name: sanitizeText(value.name),
        message: sanitizeText(value.message),
        stack: value.stack ? sanitizeText(value.stack).slice(0, 4000) : undefined,
      }
    }

    // Buffers / typed arrays (avoid huge dumps).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyVal = value as any
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(anyVal)) return `[buffer:${anyVal.length}]`
    if (anyVal instanceof Uint8Array) return `[uint8array:${anyVal.byteLength}]`

    // Maps/Sets (best-effort)
    if (anyVal instanceof Map) {
      const out: any[] = []
      let i = 0
      for (const [k, v] of anyVal.entries()) {
        if (i++ >= opts.maxArrayLength) break
        out.push([deepSanitizeInternal(k, opts, depth + 1, seen), deepSanitizeInternal(v, opts, depth + 1, seen)])
      }
      return out
    }
    if (anyVal instanceof Set) {
      const out: any[] = []
      let i = 0
      for (const v of anyVal.values()) {
        if (i++ >= opts.maxArrayLength) break
        out.push(deepSanitizeInternal(v, opts, depth + 1, seen))
      }
      return out
    }

    const out: any = {}
    const entries = Object.entries(isPlainObject(value) ? value : { ...(value as any) }).slice(0, opts.maxObjectKeys)
    for (const [k, v] of entries) {
      // Avoid prototype pollution in case untrusted objects reach here.
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
      out[k] = deepSanitizeInternal(v, opts, depth + 1, seen)
    }
    return out
  }

  return value
}

function deepSanitize(value: any, overrides?: Partial<DeepSanitizeOptions>): any {
  const opts: DeepSanitizeOptions = {
    maxDepth: Math.max(1, Math.min(20, Number(overrides?.maxDepth ?? DEFAULT_MAX_DEPTH))),
    maxArrayLength: Math.max(10, Math.min(10_000, Number(overrides?.maxArrayLength ?? DEFAULT_MAX_ARRAY))),
    maxObjectKeys: Math.max(10, Math.min(10_000, Number(overrides?.maxObjectKeys ?? DEFAULT_MAX_KEYS))),
  }
  return deepSanitizeInternal(value, opts, 0, new WeakSet())
}

export function sanitizeConsensusTrailEntry(entry: any) {
  const e = deepSanitize(entry || {}, { maxDepth: 8, maxArrayLength: 500, maxObjectKeys: 500 })

  // Ensure we never expose model/provider identifiers in logs.
  if (Array.isArray((e as any)?.per_model)) {
    ;(e as any).per_model = (e as any).per_model.map((r: any) => ({
      ok: Boolean(r?.ok),
      error: r?.error ? sanitizeText(r.error) : undefined,
    }))
  }
  if (Array.isArray((e as any)?.reviews)) {
    ;(e as any).reviews = (e as any).reviews.map((r: any) => ({
      ok: Boolean(r?.ok),
      verdict: r?.verdict
        ? {
            approve: Boolean((r as any).verdict?.approve),
            risk: Boolean((r as any).verdict?.risk),
            risk_reason: (r as any).verdict?.risk_reason ? sanitizeText((r as any).verdict.risk_reason) : undefined,
            accuracy: (r as any).verdict?.accuracy,
            confidence: (r as any).verdict?.confidence,
            notes: (r as any).verdict?.notes ? sanitizeText((r as any).verdict.notes) : undefined,
          }
        : undefined,
      error: r?.error ? sanitizeText(r.error) : undefined,
    }))
  }

  // Remove any metadata that can hint at internal architecture.
  delete (e as any).used_models
  delete (e as any).used_nodes

  return e
}

export function sanitizeUnityLogicPublicText(text: string) {
  // Public brand: keep all user-visible content framed as Unity Credit.
  const legacy = ['Unity', 'Logic'].join(' ')
  const re = new RegExp(`\\b${legacy.replace(' ', '\\\\s+')}\\b`, 'gi')
  return sanitizeText(text).replace(re, 'Unity Credit')
}


