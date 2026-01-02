import { NextRequest, NextResponse } from 'next/server'
import { sanitizeInput } from '@/lib/security'
import { getAccountGovernanceStatus } from '@/lib/account-governance'
import { createClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const gov = await getAccountGovernanceStatus(req).catch(() => null)
    if (gov?.blocked) {
      return NextResponse.json(
        { error: 'דאס קאנטע איז צייַטווייליג ריסטריקטירט. ביטע קאָנטאַקטירט סאַפּאָרט.', blocked: true },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as any
    const monthly_savings = Number(body?.monthly_savings) || 0
    const title_yi = sanitizeInput(String(body?.title_yi || '')).trim()
    const target_budget_key = sanitizeInput(String(body?.target_budget_key || '')).trim() || null
    const category = sanitizeInput(String(body?.category || '')).trim() || null

    if (!title_yi || monthly_savings <= 0) {
      return NextResponse.json({ error: 'אומגילטיגע דאטן.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id || null
    if (!userId) {
      return NextResponse.json({ error: 'ביטע לאָגט איין כדי צו אפליצירן סאווינגס.' }, { status: 401 })
    }

    const payload = {
      user_id: userId,
      event_kind: 'apply',
      monthly_savings: Math.round(monthly_savings),
      title_yi,
      target_budget_key,
      category,
    }
    const { error } = await supabase.from('user_savings_events').insert(payload as any)
    if (error) {
      return NextResponse.json({ error: 'מען קען נישט רעקארדירן די אקשן יעצט. פרובירט שפעטער.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'א טעות איז פארגעקומען.' }, { status: 500 })
  }
}


