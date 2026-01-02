import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

/**
 * Mock bank summary endpoint.
 * Use this to demo the dashboard without Plaid Link (and without phone verification).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()

  // A realistic-looking 30-day snapshot (edit anytime).
  const summary = {
    period_days: 30,
    transaction_count: 128,
    monthly_expenses: 4720,
    monthly_income: 6400,
    top_spend_categories: [
      { name: 'GROCERIES (KOSHER)', amount: 1320 },
      { name: 'TUITION', amount: 1100 },
      { name: 'INSURANCE', amount: 520 },
      { name: 'TRANSPORTATION', amount: 410 },
      { name: 'UTILITIES', amount: 360 },
    ],
    insurance_estimate: 520,
    last_updated: now,
  }

  // Heimishe category totals (monthly). Keys match your budget table keys where possible.
  const heimishe_budget = [
    { key: 'shabbosYomtov', yi: 'הוצאות שבת ויום טוב', monthly_amount: 520 }, // kosher groceries bucket -> shabbos
    { key: 'scharLimud', yi: 'שכר לימוד', monthly_amount: 1100 },
    { key: 'mikveh', yi: 'מקוה געלט', monthly_amount: 80 },
    { key: 'maaser', yi: 'מעשר', monthly_amount: 180 },
    { key: 'carInsurance', yi: 'קאר־אינשורענס', monthly_amount: 220 },
    { key: 'healthInsurance', yi: 'געזונט־אינשורענס', monthly_amount: 300 },
  ]

  const transactions_preview = [
    { date: now.slice(0, 10), merchant: 'Bingo Wholesale', name: 'Bingo Wholesale', amount: 186.24, category: 'GROCERIES (KOSHER)' },
    { date: now.slice(0, 10), merchant: 'Verizon', name: 'Verizon Wireless', amount: 142.0, category: 'UTILITIES' },
    { date: now.slice(0, 10), merchant: 'Geico', name: 'GEICO Auto', amount: 220.0, category: 'INSURANCE' },
    { date: now.slice(0, 10), merchant: 'Yeshiva Tuition', name: 'Tuition Payment', amount: 550.0, category: 'TUITION' },
    { date: now.slice(0, 10), merchant: 'Pomegranate', name: 'Pomegranate Grocery', amount: 96.5, category: 'GROCERIES (KOSHER)' },
  ]

  return NextResponse.json({
    ok: true,
    source: 'mock',
    summary,
    heimishe_budget,
    transactions_preview,
  })
}


