// Mock fallback data for offline/slow Brain and demo environments.
// This file is safe to import in client components (contains no secrets).

export const MOCK_USER = {
  email: 'test@unity.com',
  profile: { first_name: '', last_name: '' },
}

export const MOCK_CARDS = [
  { id: 'g1', last4: '4242', name: 'Chase Sapphire Preferred', apr: 26.24, limit: 18000, balance: 6200 },
  { id: 'g2', last4: '1111', name: 'Amex Blue Cash', apr: 19.99, limit: 12000, balance: 2100 },
  { id: 'g3', last4: '2222', name: 'Capital One Venture', apr: 24.49, limit: 9000, balance: 4300 },
]

export const MOCK_BANK_INSIGHTS = {
  monthly_income: 9200,
  monthly_expenses: 7100,
  total_balance: 18350,
  accounts_count: 4,
  transaction_count: 238,
  insurance_estimate: 680,
  last_updated: new Date().toISOString(),
  top_spend_categories: [
    { name: 'Groceries', amount: 1420 },
    { name: 'Utilities', amount: 560 },
    { name: 'Insurance', amount: 680 },
    { name: 'Phone/Internet', amount: 220 },
  ],
  heimishe_budget: [
    { key: 'scharLimud', yi: 'שכר לימוד', monthly_amount: 2400 },
    { key: 'rentMortgage', yi: 'דירה (רענט/מארטגעדזש)', monthly_amount: 2850 },
    { key: 'groceries', yi: 'עסן (גראָסעריס)', monthly_amount: 1200 },
    { key: 'shabbosYomtov', yi: 'הוצאות שבת ויום טוב', monthly_amount: 650 },
  ],
}

// Unity Intelligence (AI advice) mock content used for autonomous/offline UI.
export const MOCK_AI_ADVICE_TEXT = [
  'Autonomous Mode (Mock Insight)',
  '',
  '- You have strong income vs expenses momentum this month.',
  '- Biggest quick win: compare insurance + utilities — target 10–15% savings.',
  '- Credit utilization: aim for < 30% (pay down highest APR first).',
].join('\n')

// Monthly savings summary (Unity Report) mock data.
export const MOCK_MONTHLY_SAVINGS_SUMMARY = {
  ok: true,
  updated_at: new Date().toISOString(),
  provider: { monthly_total: 420 },
  flash: { one_time_total: 180 },
  applied: {
    six_month_total: 1560,
    series_6mo: [
      { month: 'Jul', value: 210 },
      { month: 'Aug', value: 240 },
      { month: 'Sep', value: 250 },
      { month: 'Oct', value: 260 },
      { month: 'Nov', value: 300 },
      { month: 'Dec', value: 300 },
    ],
  },
  potential: {
    monthly: 260,
    six_month: 1560,
    nodes_used: false,
    nodes_note: 'Autonomous Mode: showing mock projections (Brain offline or not required).',
  },
  chart: {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    applied: [
      { month: 'Jul', value: 210 },
      { month: 'Aug', value: 240 },
      { month: 'Sep', value: 250 },
      { month: 'Oct', value: 260 },
      { month: 'Nov', value: 300 },
      { month: 'Dec', value: 300 },
    ],
    potential: [
      { month: 'Jul', value: 260 },
      { month: 'Aug', value: 260 },
      { month: 'Sep', value: 260 },
      { month: 'Oct', value: 260 },
      { month: 'Nov', value: 260 },
      { month: 'Dec', value: 260 },
    ],
  },
}

// Active savings (deal hunter) mock feed.
export const MOCK_ACTIVE_SAVINGS_FEED = {
  updated_at: new Date().toISOString(),
  items: [
    {
      id: 'deal-1',
      store: 'Amazon',
      title: 'Paper towels bulk pack (subscribe & save)',
      url: 'https://www.amazon.com/',
      discount_pct: 28,
      price: 24.99,
      prev_price: 34.99,
      price_crash: true,
      buy_now_reason: 'Price dropped below 30‑day median; good time to restock.',
      observed_at: new Date().toISOString(),
    },
    {
      id: 'deal-2',
      store: 'Verizon',
      title: 'Internet plan review: possible downgrade without speed impact',
      url: 'https://www.verizon.com/',
      discount_pct: 15,
      price: 54.99,
      prev_price: 64.99,
      price_crash: false,
      buy_now_reason: 'Your usage pattern suggests a cheaper tier may be enough.',
      observed_at: new Date().toISOString(),
    },
  ],
}

// Smart alerts mock notifications (shows without requiring server-side notifications).
export const MOCK_SMART_ALERTS = {
  updated_at: new Date().toISOString(),
  items: [
    {
      id: 'notif-1',
      kind: 'bill_ready',
      title: 'Bill negotiation opportunity',
      body: 'We detected a recurring bill that may be negotiable.',
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      kind: 'deal',
      title: 'Limited-time deal detected',
      body: 'A frequent-merchant discount dropped 25%+.',
      created_at: new Date().toISOString(),
      deal: {
        store: 'Target',
        title: 'Household essentials bundle',
        url: 'https://www.target.com/',
        discount_pct: 25,
        prev_price: 79.99,
        price: 59.99,
        savings_amount: 20.0,
        price_crash: false,
      },
    },
  ],
}


