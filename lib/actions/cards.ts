'use server'

import { creditCardSchema, type CreditCardInput } from '@/lib/validations'
import { sanitizeCardLast4, validateAmount, createAuditLog } from '@/lib/security'
import { prisma } from '@/lib/prisma'

async function requireUserId(): Promise<string> {
  const { getServerSession } = await import('next-auth/next')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  const userId = String((session as any)?.user?.id || '').trim()
  if (!userId) throw new Error('Unauthorized')
  return userId
}

function toNum(v: any): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getCreditCards() {
  try {
    const userId = await requireUserId()
    const rows = await prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, last4: true, name: true, apr: true, limit: true, balance: true },
    })
    const cards = rows.map((r) => ({
      id: r.id,
      last4: r.last4,
      name: r.name,
      apr: toNum(r.apr),
      limit: toNum(r.limit) || 0,
      balance: toNum(r.balance) || 0,
    }))
    return { cards, error: null }
  } catch (error: any) {
    const msg = String(error?.message || '')
    return { error: msg.includes('Unauthorized') ? 'Unauthorized' : msg || 'Failed to fetch cards', cards: [] }
  }
}

export async function createCreditCard(data: CreditCardInput) {
  try {
    const userId = await requireUserId()

    // Validate input
    const validationResult = creditCardSchema.safeParse({
      last4: sanitizeCardLast4(data.last4),
      name: data.name.trim().slice(0, 100),
      apr: data.apr,
      limit: data.limit,
      balance: data.balance,
    })

    if (!validationResult.success) {
      return {
        error: 'Invalid input',
        details: validationResult.error.errors,
        card: null,
      }
    }

    const { last4, name, apr, limit, balance } = validationResult.data

    // Additional security validation
    if (!validateAmount(limit) || !validateAmount(balance)) {
      return { error: 'Invalid amount values', card: null }
    }

    // Create audit log
    const auditLog = createAuditLog(
      userId,
      'CREATE_CREDIT_CARD',
      'credit_cards',
      { cardName: name, last4 }
    )

    const card = await prisma.creditCard.create({
      data: { userId, last4, name, apr: apr ?? null, limit, balance } as any,
      select: { id: true, last4: true, name: true, apr: true, limit: true, balance: true },
    })

    // Log audit (optional)
    // await supabase.from('audit_logs').insert(auditLog)

    return {
      card: {
        id: card.id,
        last4: card.last4,
        name: card.name,
        apr: toNum(card.apr),
        limit: toNum(card.limit) || 0,
        balance: toNum(card.balance) || 0,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || 'Failed to create card', card: null }
  }
}

export async function deleteCreditCard(cardId: string) {
  try {
    const userId = await requireUserId()

    // Verify card belongs to user
    const card = await prisma.creditCard.findFirst({
      where: { id: String(cardId || '').trim(), userId },
      select: { id: true, name: true, last4: true },
    })
    if (!card?.id) {
      return { error: 'Card not found or unauthorized', success: false }
    }

    // Create audit log
    const auditLog = createAuditLog(
      userId,
      'DELETE_CREDIT_CARD',
      'credit_cards',
      { cardId, cardName: card.name, last4: card.last4 }
    )

    await prisma.creditCard.delete({ where: { id: card.id } }).catch(() => null)

    // Log audit (optional)
    // await supabase.from('audit_logs').insert(auditLog)

    return { success: true, error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to delete card', success: false }
  }
}

export async function updateCreditCard(
  cardId: string,
  data: Partial<CreditCardInput>
) {
  try {
    const userId = await requireUserId()

    // Build update object
    const updateData: any = {}
    if (data.last4) updateData.last4 = sanitizeCardLast4(data.last4)
    if (data.name) updateData.name = data.name.trim().slice(0, 100)
    if (data.limit !== undefined) {
      if (!validateAmount(data.limit)) {
        return { error: 'Invalid limit amount', card: null }
      }
      updateData.limit = data.limit
    }
    if (data.apr !== undefined) {
      if (!Number.isFinite(data.apr) || data.apr < 0 || data.apr > 60) {
        return { error: 'Invalid APR value', card: null }
      }
      updateData.apr = data.apr
    }
    if (data.balance !== undefined) {
      if (!validateAmount(data.balance)) {
        return { error: 'Invalid balance amount', card: null }
      }
      updateData.balance = data.balance
    }

    // Validate balance doesn't exceed limit
    if (updateData.balance !== undefined && updateData.limit !== undefined) {
      if (updateData.balance > updateData.limit) {
        return { error: 'Balance cannot exceed limit', card: null }
      }
    }

    const existing = await prisma.creditCard.findFirst({ where: { id: String(cardId || '').trim(), userId }, select: { id: true } })
    if (!existing?.id) return { error: 'Card not found or unauthorized', card: null }

    const card = await prisma.creditCard.update({
      where: { id: existing.id },
      data: updateData,
      select: { id: true, last4: true, name: true, apr: true, limit: true, balance: true },
    })

    return {
      card: {
        id: card.id,
        last4: card.last4,
        name: card.name,
        apr: toNum(card.apr),
        limit: toNum(card.limit) || 0,
        balance: toNum(card.balance) || 0,
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || 'Failed to update card', card: null }
  }
}

