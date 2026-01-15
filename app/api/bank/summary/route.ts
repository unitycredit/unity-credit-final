import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function daysAgoISO(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET
  const token = secret ? await getToken({ req, secret }) : null
  const userId = String((token as any)?.uid || (token as any)?.sub || '').trim()
  if (!userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const since = daysAgoISO(30)
  const sinceDate = new Date(`${since}T00:00:00.000Z`)

  const tx = await prisma.plaidTransaction
    .findMany({
      where: { userId, occurredOn: { gte: sinceDate } },
      orderBy: { occurredOn: 'desc' },
      take: 500,
      select: {
        plaidTransactionId: true,
        amount: true,
        currency: true,
        name: true,
        merchantName: true,
        categoryPrimary: true,
        occurredOn: true,
        createdAt: true,
      },
    })
    .catch(() => [] as any[])

  let monthlyExpenses = 0
  let monthlyIncome = 0
  const categoryTotals = new Map<string, number>()
  let insuranceEstimate = 0

  for (const t of tx) {
    const amt = Number((t as any)?.amount) || 0
    const cat = String((t as any)?.categoryPrimary || 'Unknown')
    const catUpper = cat.toUpperCase()
    const merchant = String((t as any)?.merchantName || (t as any)?.name || '').toLowerCase()
    const isIncome = amt < 0 || catUpper === 'INCOME'
    if (isIncome) {
      monthlyIncome += Math.abs(amt)
      continue
    }
    monthlyExpenses += amt
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + amt)
    if (cat.toLowerCase().includes('insurance') || merchant.includes('insurance')) insuranceEstimate += amt
  }

  const top_spend_categories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const transactions_preview = tx.slice(0, 120).map((t) => {
    const merchant = String((t as any)?.merchantName || '').trim()
    const name = String((t as any)?.name || '').trim()
    return {
      date: (t as any)?.occurredOn ? new Date((t as any).occurredOn).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      merchant: merchant || name || '—',
      name: name || merchant || '—',
      amount: Math.round((Number((t as any)?.amount) || 0) * 100) / 100,
      category: String((t as any)?.categoryPrimary || 'Unknown'),
    }
  })

  // Balances from RDS (plaid_accounts).
  let total_balance: number | undefined = undefined
  let accounts_count: number | undefined = undefined

  try {
    const rows = await prisma.plaidAccount.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { currentBalance: true },
    })
    if (rows.length) {
      accounts_count = rows.length
      let sum = 0
      for (const r of rows) {
        const v = Number((r as any)?.currentBalance)
        if (Number.isFinite(v)) sum += v
      }
      total_balance = Math.round(sum)
    }
  } catch (e: any) {
    void e
  }

  const summary = {
    period_days: 30,
    transaction_count: tx.length,
    monthly_expenses: Math.round(monthlyExpenses),
    monthly_income: monthlyIncome > 0 ? Math.round(monthlyIncome) : null,
    total_balance,
    accounts_count,
    top_spend_categories,
    insurance_estimate: Math.round(insuranceEstimate),
    last_updated: new Date().toISOString(),
  }

  // Include sync state when available (drives "Re-connect Required" UI)
  let sync_state: any = null
  try {
    const s = await prisma.bankSyncState.findUnique({
      where: { userId },
      select: { status: true, lastSyncAt: true, lastSuccessAt: true, lastErrorCode: true, lastErrorMessage: true, updatedAt: true },
    })
    sync_state = s
      ? {
          status: s.status,
          last_sync_at: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
          last_success_at: s.lastSuccessAt ? s.lastSuccessAt.toISOString() : null,
          last_error_code: s.lastErrorCode,
          last_error_message: s.lastErrorMessage,
          updated_at: s.updatedAt ? s.updatedAt.toISOString() : null,
        }
      : null
  } catch {
    sync_state = null
  }

  return NextResponse.json({ ok: true, source: 'rds', summary, transactions_preview, sync_state }, { headers: { 'Cache-Control': 'no-store' } })
}


