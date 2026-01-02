export type CleanedTransaction = {
  /** Original merchant/name (best-effort) */
  merchant_raw: string
  name_raw: string
  /** Cleaned label used for grouping + insights context */
  label: string
  /** A compact, normalized key for grouping */
  label_key: string
}

function safeText(v: any) {
  return String(v || '').trim()
}

// Remove common noise tokens that explode merchant grouping.
const NOISE = [
  'pos',
  'purchase',
  'debit',
  'credit',
  'visa',
  'mastercard',
  'mc',
  'amex',
  'card',
  'online',
  'web',
  'ach',
  'atm',
  'withdrawal',
  'payment',
  'recurring',
  'authorization',
  'auth',
  'pending',
  'pmt',
  'sq',
  'square',
  'paypal',
]

export function cleanMerchantLabel(merchant: string, name: string) {
  const m = safeText(merchant)
  const n = safeText(name)
  const base = m || n || ''
  if (!base) return { label: '', label_key: '' }

  // Normalize to ASCII-ish token stream; keep Hebrew letters too.
  const normalized = base
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // strip niqqud
    .replace(/[^a-z0-9\u0590-\u05FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .filter((t) => t.length >= 2)
    .filter((t) => !NOISE.includes(t))
    // drop mostly-numeric tokens (reference ids)
    .filter((t) => !/^\d+$/.test(t))
    .slice(0, 8)

  const label_key = tokens.join(' ').slice(0, 80)
  // Preserve a readable label: prefer merchant if present, otherwise cleaned name.
  const label = (m || n).trim().slice(0, 120)
  return { label, label_key }
}

export function cleanTransactionForGrouping(params: { merchant: string; name: string }): CleanedTransaction {
  const merchant_raw = safeText(params.merchant)
  const name_raw = safeText(params.name)
  const cleaned = cleanMerchantLabel(merchant_raw, name_raw)
  return {
    merchant_raw,
    name_raw,
    label: cleaned.label,
    label_key: cleaned.label_key,
  }
}


