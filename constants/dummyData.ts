// Dummy fallback data for offline/slow Brain and demo environments.
// This file is safe to import in client components (contains no secrets).

export const DUMMY_USER = {
  email: 'test@unity.com',
  profile: { first_name: '', last_name: '' },
}

export const DUMMY_CARDS = [
  { id: 'g1', last4: '4242', name: 'Chase Sapphire Preferred', apr: 26.24, limit: 18000, balance: 6200 },
  { id: 'g2', last4: '1111', name: 'Amex Blue Cash', apr: 19.99, limit: 12000, balance: 2100 },
  { id: 'g3', last4: '2222', name: 'Capital One Venture', apr: 24.49, limit: 9000, balance: 4300 },
]

export const DUMMY_BANK_INSIGHTS = {
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


