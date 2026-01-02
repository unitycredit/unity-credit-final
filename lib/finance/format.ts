import { toFiniteNumber } from '@/lib/finance/number'

export function formatUsd(
  value: unknown,
  opts?: { digits?: 0 | 1 | 2; fallbackText?: string; locale?: string }
): string {
  const digits = opts?.digits ?? 0
  const fallbackText = opts?.fallbackText ?? 'Syncing…'
  const n = toFiniteNumber(value, NaN as any)
  if (!Number.isFinite(n)) return fallbackText
  const locale = opts?.locale ?? 'en-US'
  return `$${n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function formatPercent(
  value: unknown,
  opts?: { digits?: 0 | 1 | 2; fallbackText?: string }
): string {
  const digits = opts?.digits ?? 1
  const fallbackText = opts?.fallbackText ?? 'Syncing…'
  const n = toFiniteNumber(value, NaN as any)
  if (!Number.isFinite(n)) return fallbackText
  return `${n.toFixed(digits)}%`
}


