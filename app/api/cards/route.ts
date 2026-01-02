import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { creditCardSchema } from '@/lib/validations'
import { sanitizeCardLast4, validateAmount, createAuditLog } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ cards: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate and sanitize input
    const body = await request.json()
    const validationResult = creditCardSchema.safeParse({
      last4: sanitizeCardLast4(body.last4),
      name: body.name?.trim().slice(0, 100),
      apr: body.apr !== undefined && body.apr !== null ? parseFloat(body.apr) : undefined,
      limit: parseFloat(body.limit),
      balance: parseFloat(body.balance),
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { last4, name, apr, limit, balance } = validationResult.data

    // Additional security validation
    if (!validateAmount(limit) || !validateAmount(balance)) {
      return NextResponse.json(
        { error: 'Invalid amount values' },
        { status: 400 }
      )
    }

    // Create audit log
    const auditLog = createAuditLog(
      user.id,
      'CREATE_CREDIT_CARD',
      'credit_cards',
      { cardName: name, last4 }
    )

    const { data, error } = await supabase
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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ card: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create card' },
      { status: 500 }
    )
  }
}
