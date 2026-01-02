'use server'

import { createClient } from '@/lib/supabase'
import { creditCardSchema, type CreditCardInput } from '@/lib/validations'
import { sanitizeCardLast4, validateAmount, createAuditLog } from '@/lib/security'

export async function getCreditCards() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Unauthorized', cards: [] }
    }

    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { error: error.message, cards: [] }
    }

    return { cards: data || [], error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to fetch cards', cards: [] }
  }
}

export async function createCreditCard(data: CreditCardInput) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Unauthorized', card: null }
    }

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
      user.id,
      'CREATE_CREDIT_CARD',
      'credit_cards',
      { cardName: name, last4 }
    )

    const { data: card, error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: user.id,
        last4,
        name,
        apr: apr ?? null,
        limit,
        balance,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message, card: null }
    }

    // Log audit (optional)
    // await supabase.from('audit_logs').insert(auditLog)

    return { card, error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to create card', card: null }
  }
}

export async function deleteCreditCard(cardId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Unauthorized', success: false }
    }

    // Verify card belongs to user
    const { data: card } = await supabase
      .from('credit_cards')
      .select('id, name, last4')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single()

    if (!card) {
      return { error: 'Card not found or unauthorized', success: false }
    }

    // Create audit log
    const auditLog = createAuditLog(
      user.id,
      'DELETE_CREDIT_CARD',
      'credit_cards',
      { cardId, cardName: card.name, last4: card.last4 }
    )

    const { error } = await supabase
      .from('credit_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', user.id)

    if (error) {
      return { error: error.message, success: false }
    }

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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Unauthorized', card: null }
    }

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

    const { data: card, error } = await supabase
      .from('credit_cards')
      .update(updateData)
      .eq('id', cardId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return { error: error.message, card: null }
    }

    return { card, error: null }
  } catch (error: any) {
    return { error: error.message || 'Failed to update card', card: null }
  }
}

