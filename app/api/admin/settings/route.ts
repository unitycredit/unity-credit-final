import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readAdminSettings, writeAdminSettings } from '@/lib/admin-settings'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const settings = await readAdminSettings()
  return NextResponse.json({ ok: true, settings })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  const disclaimer_yi = typeof body?.disclaimer_yi === 'string' ? body.disclaimer_yi : undefined
  const heimishe_categories = Array.isArray(body?.heimishe_categories) ? body.heimishe_categories : undefined
  const require_all_nodes = typeof body?.require_all_nodes === 'boolean' ? body.require_all_nodes : undefined
  const house_insurance_negotiation_template_yi =
    typeof body?.house_insurance_negotiation_template_yi === 'string' ? body.house_insurance_negotiation_template_yi : undefined
  const car_insurance_negotiation_template_yi =
    typeof body?.car_insurance_negotiation_template_yi === 'string' ? body.car_insurance_negotiation_template_yi : undefined
  const life_insurance_negotiation_template_yi =
    typeof body?.life_insurance_negotiation_template_yi === 'string' ? body.life_insurance_negotiation_template_yi : undefined
  const saved = await writeAdminSettings({
    disclaimer_yi,
    heimishe_categories,
    require_all_nodes,
    house_insurance_negotiation_template_yi,
    car_insurance_negotiation_template_yi,
    life_insurance_negotiation_template_yi,
  })
  return NextResponse.json({ ok: true, settings: saved })
}


