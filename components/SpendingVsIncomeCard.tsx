'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

type Props = {
  income: number
  expenses: number
  onIncomeChange: (v: number) => void
  onExpensesChange: (v: number) => void
}

export default function SpendingVsIncomeCard({ income, expenses, onIncomeChange, onExpensesChange }: Props) {

  const { savings, expenseRatio } = useMemo(() => {
    const safeIncome = Number.isFinite(income) ? income : 0
    const safeExpenses = Number.isFinite(expenses) ? expenses : 0
    const s = safeIncome - safeExpenses
    const ratio = safeIncome > 0 ? safeExpenses / safeIncome : 0
    return { savings: s, expenseRatio: ratio }
  }, [income, expenses])

  const maxVal = Math.max(1, income, expenses)
  const incomePct = clamp((income / maxVal) * 100, 0, 100)
  const expensesPct = clamp((expenses / maxVal) * 100, 0, 100)

  const savingsGood = savings >= 0

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-600" />
      <CardHeader className="pb-4">
        <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2">
          <Wallet className="h-5 w-5 text-indigo-600" />
          הוצאות קעגן הכנסות
        </CardTitle>
        <p className="rtl-text text-base text-muted-foreground text-right">
          א קלארער איבערבליק פון אייער מאנאטליכע הכנסות קעגן הוצאות.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 rtl-text text-right">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="income" className="rtl-text font-semibold text-primary">
              מאנאטליכע הכנסה
            </Label>
            <Input
              id="income"
              dir="rtl"
              type="number"
              min={0}
              step={50}
              value={Number.isFinite(income) ? income : 0}
              onChange={(e) => onIncomeChange(Number(e.target.value || 0))}
              className="h-12 border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expenses" className="rtl-text font-semibold text-primary">
              מאנאטליכע הוצאות
            </Label>
            <Input
              id="expenses"
              dir="rtl"
              type="number"
              min={0}
              step={50}
              value={Number.isFinite(expenses) ? expenses : 0}
              onChange={(e) => onExpensesChange(Number(e.target.value || 0))}
              className="h-12 border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 rtl-text text-right">
          <div className="flex items-center justify-between rtl-text mb-3">
            <span className="text-base font-semibold text-primary">גראַף</span>
            <span className="text-xs text-muted-foreground">
              הוצאות/הכנסות: {(expenseRatio * 100).toFixed(0)}%
            </span>
          </div>

          <div className="space-y-3">
            <div className="rtl-text text-right">
              <div className="flex items-center justify-between text-base rtl-text">
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  הכנסה
                </span>
                <span className="font-bold text-primary">${income.toFixed(0)}</span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                  style={{ width: `${incomePct}%` }}
                />
              </div>
            </div>

            <div className="rtl-text text-right">
              <div className="flex items-center justify-between text-base rtl-text">
                <span className="inline-flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                  הוצאות
                </span>
                <span className="font-bold text-primary">${expenses.toFixed(0)}</span>
              </div>
              <div className="mt-2 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                  style={{ width: `${expensesPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-[#f8fafc] p-3 rtl-text">
            <div className="flex items-center justify-between">
              <span className="text-base text-muted-foreground">פארבליבן / סאווינגס</span>
              <span className={`font-black ${savingsGood ? 'text-[#00ff00]' : 'text-rose-700'}`}>
                ${savings.toFixed(0)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              די דאטן ווערן נישט געשפארט — זיי ווערן בלויז גענוצט פאר אייך צו זען דעם איבערבליק אין רעאל־צייט.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


