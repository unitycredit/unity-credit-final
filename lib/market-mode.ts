export type MarketMode = 'jewish_local' | 'general_national'

export const MARKET_MODE_COOKIE = 'uc_market_mode'
export const DEFAULT_MARKET_MODE: MarketMode = 'jewish_local'

export function normalizeMarketMode(input: any): MarketMode {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')

  if (raw === 'general' || raw === 'national' || raw === 'general_national') return 'general_national'
  if (raw === 'jewish' || raw === 'local' || raw === 'jewish_local') return 'jewish_local'
  return DEFAULT_MARKET_MODE
}

export function marketModeToStorageSuffix(mode: MarketMode) {
  return mode === 'general_national' ? 'general' : 'local'
}


