import type { CatalogProvider, CatalogKind } from '@/lib/category-catalog'

function baseInsuranceProviders(): CatalogProvider[] {
  const commonDiscounts = [
    { title: 'Multi‑policy bundle (home + auto)', how_to_claim: 'Ask for a bundle quote and confirm the bundle discount is applied.', source_urls: [], confidence: 'low' as const },
    { title: 'Autopay / paperless billing discount', how_to_claim: 'Enable autopay + paperless and request confirmation of any discount.', source_urls: [], confidence: 'low' as const },
    { title: 'Loyalty / tenure discount', how_to_claim: 'If you have prior tenure, request a loyalty review.', source_urls: [], confidence: 'low' as const },
    { title: 'Claims‑free / safe history review', how_to_claim: 'Ask the agent to re-rate with updated loss history / driving record where applicable.', source_urls: [], confidence: 'low' as const },
  ]

  const mk = (name: string): CatalogProvider => ({
    name,
    offers: [
      {
        title: 'Quote review / re‑rating',
        details: 'Request a full re‑rate using updated details and confirm all eligible discounts are applied.',
        source_urls: [],
        confidence: 'low',
      },
    ],
    hidden_discounts: commonDiscounts,
    source_urls: [],
    notes: 'Offline master list (no live sources configured).',
    confidence: 'low',
  })

  return [
    mk('State Farm'),
    mk('GEICO'),
    mk('Progressive'),
    mk('Allstate'),
    mk('USAA'),
    mk('Liberty Mutual'),
    mk('Farmers'),
    mk('Nationwide'),
    mk('Travelers'),
  ]
}

function amazonWalmartProviders(): CatalogProvider[] {
  return [
    {
      name: 'Amazon',
      offers: [
        { title: 'Prime member pricing (varies)', details: 'Check if Prime pricing applies and compare with non‑Prime price.', source_urls: [], confidence: 'low' },
        { title: 'Subscribe & Save (eligible items)', details: 'Consider subscription pricing when it is cancelable and truly saves money.', source_urls: [], confidence: 'low' },
      ],
      hidden_discounts: [
        { title: 'Cashback portals', how_to_claim: 'Check reputable cashback portals before checkout; compare rates.', source_urls: [], confidence: 'low' },
        { title: 'Gift card stacking (when discounted)', how_to_claim: 'If you acquire discounted gift cards, ensure it’s legitimate and fees don’t erase savings.', source_urls: [], confidence: 'low' },
      ],
      source_urls: [],
      notes: 'Offline master list (no live sources configured).',
      confidence: 'low',
    },
    {
      name: 'Walmart',
      offers: [
        { title: 'Rollback / clearance pricing (varies)', details: 'Watch for clearance tags and compare to historical pricing when possible.', source_urls: [], confidence: 'low' },
        { title: 'Pickup/delivery promos (varies)', details: 'Check for account‑eligible promos and minimum‑basket thresholds.', source_urls: [], confidence: 'low' },
      ],
      hidden_discounts: [
        { title: 'Store pickup vs shipping arbitrage', how_to_claim: 'Compare pickup vs shipped SKU pricing and total fees.', source_urls: [], confidence: 'low' },
        { title: 'Category‑based cashback strategy', how_to_claim: 'Use category bonuses when available; avoid overspending for points.', source_urls: [], confidence: 'low' },
      ],
      source_urls: [],
      notes: 'Offline master list (no live sources configured).',
      confidence: 'low',
    },
  ]
}

function heimishHubProviders(): CatalogProvider[] {
  const mk = (name: string, opts: { membership?: string; points?: string }): CatalogProvider => ({
    name,
    offers: [
      {
        title: 'Weekly specials / circular',
        details: 'Track weekly promos and stock-up items you already buy; avoid overbuying for “deals”.',
        source_urls: [],
        confidence: 'low' as const,
      },
    ],
    hidden_discounts: [
      ...(opts.membership
        ? [
            {
              title: `${opts.membership} benefits`,
              how_to_claim: 'Ensure membership is active and that member-only pricing is applied at checkout.',
              source_urls: [],
              confidence: 'low' as const,
            },
          ]
        : []),
      ...(opts.points
        ? [
            {
              title: `${opts.points} points / credits`,
              how_to_claim: 'Ask how points accrue and when they can be redeemed; verify redemption rules.',
              source_urls: [],
              confidence: 'low' as const,
            },
          ]
        : []),
      {
        title: 'Bulk purchase strategy',
        how_to_claim: 'Buy bulk only on fast-moving staples; set a max-per-unit threshold and stick to it.',
        source_urls: [],
        confidence: 'low' as const,
      },
      {
        title: 'Gift card promos (when available)',
        how_to_claim: 'If legitimate gift card promos exist, validate fees/terms before purchasing.',
        source_urls: [],
        confidence: 'low' as const,
      },
    ],
    source_urls: [],
    notes: 'Offline master list (no live sources configured).',
    confidence: 'low' as const,
  })

  return [
    mk('Bingo Wholesale', { membership: 'Bingo Membership', points: 'Bingo Membership' }),
    mk('Evergreen', { points: 'Evercard' }),
    mk('Rockland Kosher', {}),
    mk('NPGS', {}),
    mk('Pomegranate', {}),
    mk('Seasons', {}),
    // Points program relevant to local shopping behavior
    mk('Target', { points: 'Target RedCard' }),
  ]
}

export function offlineProvidersForCategory(params: { key: string; label: string; kind: CatalogKind }): CatalogProvider[] {
  const key = String(params.key || '')
  const kind = params.kind

  if (kind === 'insurance') {
    if (key === 'insurance_brokers_local') {
      return [
        {
          name: 'Local Insurance Broker',
          offers: [
            {
              title: 'Policy re‑shop across carriers',
              details: 'Broker can re-shop rates across multiple carriers and adjust deductibles/coverage.',
              source_urls: [],
              confidence: 'low',
            },
          ],
          hidden_discounts: [
            { title: 'Bundling strategy', how_to_claim: 'Ask broker to bundle home+auto where possible and confirm discount.', source_urls: [], confidence: 'low' },
            { title: 'Deductible calibration', how_to_claim: 'Compare deductible changes vs premium; pick the rational point.', source_urls: [], confidence: 'low' },
            { title: 'Claims-free / safe driver credits', how_to_claim: 'Have broker validate rating factors and loss history.', source_urls: [], confidence: 'low' },
          ],
          source_urls: [],
          notes: 'Offline master list (no live sources configured). Add real broker names in Category Manager.',
          confidence: 'low',
        },
        {
          name: 'Specialized Heimish Broker',
          offers: [
            {
              title: 'Community-specific policy review',
              details: 'Review coverage details and shopping strategy tailored to community needs (still conservative).',
              source_urls: [],
              confidence: 'low',
            },
          ],
          hidden_discounts: [
            { title: 'Paperless/autopay review', how_to_claim: 'Ensure all billing discounts are enabled.', source_urls: [], confidence: 'low' },
            { title: 'Home safety device credits', how_to_claim: 'Ask which safety devices earn credits and document installation.', source_urls: [], confidence: 'low' },
          ],
          source_urls: [],
          notes: 'Offline master list (no live sources configured).',
          confidence: 'low',
        },
      ]
    }
    return baseInsuranceProviders()
  }

  if (key === 'shopping_bh_photo') {
    return [
      {
        name: 'B&H Photo',
        offers: [
          {
            title: 'Payboo tax-savings option (when eligible)',
            details:
              'Compare the sales-tax savings against your card rewards value for high-ticket items; assumptions matter (redemption value).',
            source_urls: [],
            confidence: 'low',
          },
        ],
        hidden_discounts: [
          {
            title: 'Tax-savings vs points break-even',
            how_to_claim: 'Compute: tax_rate% vs rewards_rate% × redemption multiplier. Pick the higher dollar value.',
            source_urls: [],
            confidence: 'low',
          },
          {
            title: 'Price protection / return policy awareness',
            how_to_claim: 'Confirm return window and any restocking fees; avoid optimizing points while losing flexibility.',
            source_urls: [],
            confidence: 'low',
          },
        ],
        source_urls: [],
        notes: 'Offline master list (no live sources configured). Use the Payboo vs Points optimizer in Admin.',
        confidence: 'low',
      },
    ]
  }

  if (key === 'shopping_heimish_hubs') {
    return heimishHubProviders()
  }

  if (key === 'shopping_amazon' || key === 'shopping_walmart') {
    return amazonWalmartProviders()
  }

  // Generic shopping categories: still seed Amazon/Walmart as primary providers.
  if (kind === 'shopping') {
    return [...amazonWalmartProviders(), ...heimishHubProviders()]
  }

  return []
}


