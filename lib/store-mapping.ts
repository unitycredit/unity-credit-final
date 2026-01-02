import type { StoreKey } from '@/lib/local-price-index'
import { mapHeimishHub } from '@/lib/heimish-hubs'

function norm(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u0590-\u05FF]+/g, ' ').trim()
}

export function mapStoreKey(merchantOrName: string): StoreKey | null {
  const t = norm(merchantOrName)
  if (!t) return null

  // Heimish hubs
  const hub = mapHeimishHub(merchantOrName)
  if (hub?.key === 'bingo_wholesale') return 'bingo'
  if (hub?.key === 'evergreen') return 'evergreen'

  // Big box
  if (t.includes('walmart')) return 'walmart'
  if (t.includes('costco')) return 'costco'

  return null
}


