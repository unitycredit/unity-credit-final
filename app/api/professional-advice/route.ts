import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { adviceQuestionSchema } from '@/lib/validations'
import { sanitizeInput, createAuditLog } from '@/lib/security'
import { sanitizeUnityLogicPublicText } from '@/lib/sanitize'
import { creditCardRowSchema } from '@/lib/finance/types'
import { callUnityBrainOffice } from '@/lib/unity-brain-office'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated (in production this route is protected by auth)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = adviceQuestionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'אומגילטיגע אינפּוט', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const sanitizedQuestion = sanitizeInput(validationResult.data.question)

    // Context from user's credit cards (optional)
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)

    createAuditLog(user.id, 'PRO_ADVICE_REQUEST', 'professional_advice', {
      questionLength: sanitizedQuestion.length,
    })

    let context = ''
    if (Array.isArray(cards) && cards.length > 0) {
      const parsed = cards
        .map((c: any) => creditCardRowSchema.safeParse(c))
        .filter((r) => r.success)
        .map((r) => (r as any).data)
      context = JSON.stringify(parsed.map((c: any) => ({ limit: Number(c.limit) || 0, balance: Number(c.balance) || 0 })))
    }

    const isYiddish = /[א-ת]/.test(sanitizedQuestion)
    const responseLanguage = isYiddish ? 'Yiddish (Heimishe style)' : 'English'

    const forwarded = await callUnityBrainOffice({
      path: '/v1/professional-advice',
      body: {
        question: sanitizedQuestion,
        cards: (() => {
          try {
            const arr = JSON.parse(context || '[]')
            return Array.isArray(arr) ? arr : []
          } catch {
            return []
          }
        })(),
      },
      req: request as any,
    })
    if (!forwarded.ok) {
      return NextResponse.json(
        { error: String((forwarded.json as any)?.error || 'סיסטעם־טעות. ביטע פרובירט נאכאמאל.') },
        { status: forwarded.status }
      )
    }

    const response = String((forwarded.json as any)?.final || '').trim() || 'אנטשולדיגט, עס איז נישט געלונגען צו שאפֿן א ענטפער.'

    // Brand guard: never reveal internal vendor/model framing; keep it framed as Unity Credit + Nodes.
    // (Even though this route is "professional advice", we keep a consistent public framing.)
    return NextResponse.json({ response: sanitizeUnityLogicPublicText(response) })
  } catch (error: any) {
    console.error('Advice service error:', error)

    let errorMessage = 'עס איז נישט געלונגען צו באקומען פראפעסיאנעלע עצה'
    if (error.message?.includes('rate_limit')) {
      errorMessage = 'צו פיל פראבען. ביטע פרובירט נאכאמאל שפעטער.'
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


