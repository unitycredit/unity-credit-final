import { z } from 'zod'
import { toFiniteNonNegativeNumber, toFiniteNumber } from '@/lib/finance/number'

const finiteNumber = z.preprocess((v) => toFiniteNumber(v, NaN as any), z.number().finite())
const finiteNonNegative = z.preprocess((v) => toFiniteNonNegativeNumber(v, 0), z.number().finite().min(0))

export const creditCardRowSchema = z.object({
  id: z.string().min(1),
  last4: z.string().min(4),
  name: z.string().min(1),
  apr: z
    .preprocess((v) => {
      if (v === null || typeof v === 'undefined') return null
      const n = toFiniteNumber(v, NaN as any)
      return Number.isFinite(n) ? n : null
    }, z.number().min(0).max(60).nullable())
    .optional(),
  limit: finiteNonNegative,
  balance: finiteNonNegative,
})

export type CreditCard = z.infer<typeof creditCardRowSchema>

export type BankSpendCategory = { name: string; amount: number }
export type BankTransactionPreview = { date: string; merchant: string; name: string; amount: number; category: string }
export type HeimisheBudgetRow = { key: string; yi: string; monthly_amount: number }

export const bankSummarySchema = z.object({
  monthly_income: finiteNumber.nullable(),
  monthly_expenses: finiteNonNegative,
  total_balance: finiteNonNegative.optional(),
  accounts_count: finiteNonNegative.optional(),
  transaction_count: finiteNonNegative.optional(),
  top_spend_categories: z
    .array(z.object({ name: z.string(), amount: finiteNonNegative }))
    .optional(),
  insurance_estimate: finiteNonNegative.optional(),
  last_updated: z.string().optional(),
  heimishe_budget: z
    .array(z.object({ key: z.string(), yi: z.string(), monthly_amount: finiteNonNegative }))
    .optional(),
  transactions_preview: z
    .array(
      z.object({
        date: z.string(),
        merchant: z.string(),
        name: z.string(),
        amount: finiteNumber,
        category: z.string(),
      })
    )
    .optional(),
})

export type BankSummary = z.infer<typeof bankSummarySchema>


