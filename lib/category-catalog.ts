export type CatalogKind = 'shopping' | 'insurance'

export type CatalogOffer = {
  title: string
  details?: string
  price?: string
  discount?: string
  expires_at?: string | null
  source_urls: string[]
  confidence?: 'high' | 'medium' | 'low'
}

export type CatalogDiscount = {
  title: string
  how_to_claim?: string
  source_urls: string[]
  confidence?: 'high' | 'medium' | 'low'
}

export type CatalogProvider = {
  name: string
  offers: CatalogOffer[]
  hidden_discounts: CatalogDiscount[]
  source_urls: string[]
  notes?: string
  confidence?: 'high' | 'medium' | 'low'
}

export type CategoryCatalogEntry = {
  key: string
  label: string
  kind: CatalogKind
  updated_at: string
  generated_at?: string | null
  providers: CatalogProvider[]
  sources: Array<{ title: string; url: string; snippet?: string }>
  raw?: string | null
}

export type CategoryCatalogDB = {
  v: 1
  updated_at: string
  categories: CategoryCatalogEntry[]
}

export function nowIso() {
  return new Date().toISOString()
}

export function defaultCategorySeeds(): Array<Pick<CategoryCatalogEntry, 'key' | 'label' | 'kind'>> {
  return [
    { key: 'shopping_amazon', label: 'Amazon Deals', kind: 'shopping' },
    { key: 'shopping_walmart', label: 'Walmart Deals', kind: 'shopping' },
    { key: 'shopping_heimish_hubs', label: 'Heimish Hubs (Local)', kind: 'shopping' },
    { key: 'shopping_bh_photo', label: 'B&H Photo (High-Ticket)', kind: 'shopping' },
    { key: 'shopping_electronics', label: 'Electronics', kind: 'shopping' },
    { key: 'shopping_home', label: 'Home & Kitchen', kind: 'shopping' },
    { key: 'shopping_grocery', label: 'Grocery', kind: 'shopping' },
    { key: 'shopping_baby', label: 'Baby', kind: 'shopping' },
    { key: 'shopping_pharmacy', label: 'Pharmacy / OTC', kind: 'shopping' },
    { key: 'shopping_clothing', label: 'Clothing', kind: 'shopping' },
    { key: 'shopping_tools', label: 'Tools', kind: 'shopping' },
    { key: 'insurance_home', label: 'Home Insurance', kind: 'insurance' },
    { key: 'insurance_car', label: 'Car Insurance', kind: 'insurance' },
    { key: 'insurance_life', label: 'Life Insurance', kind: 'insurance' },
    { key: 'insurance_brokers_local', label: 'Insurance Brokers (Local)', kind: 'insurance' },
  ]
}

export function emptyCatalog(): CategoryCatalogDB {
  return { v: 1, updated_at: nowIso(), categories: [] }
}

export function normalizeKey(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}


