export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return fallback
    const n = Number(s)
    return Number.isFinite(n) ? n : fallback
  }
  // Common Supabase numeric shapes (rare but defensive)
  if (value && typeof value === 'object' && 'value' in (value as any)) {
    return toFiniteNumber((value as any).value, fallback)
  }
  return fallback
}

export function toFiniteNonNegativeNumber(value: unknown, fallback = 0): number {
  const n = toFiniteNumber(value, fallback)
  return n < 0 ? 0 : n
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}


