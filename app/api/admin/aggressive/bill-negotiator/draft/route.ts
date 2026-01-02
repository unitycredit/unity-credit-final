import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { sanitizeInput } from '@/lib/security'
import { buildBillNegotiationDraft, type BillType } from '@/lib/bill-negotiator'
import { appendGlobal, readGlobalNotifications, writeGlobalNotifications } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'נישט ערלויבט' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as any

  const provider_name = sanitizeInput(String(body?.provider_name || '')).trim()
  const bill_type: BillType = String(body?.bill_type || 'utility') === 'cellular' ? 'cellular' : 'utility'
  const current_monthly = Number(body?.current_monthly)
  const desired_monthly = Number(body?.desired_monthly)
  const account_hint = sanitizeInput(String(body?.account_hint || '')).trim() || null
  const notes = sanitizeInput(String(body?.notes || '')).trim() || null

  if (!provider_name) return NextResponse.json({ error: 'עס פעלט דער פראוויידער.' }, { status: 400 })
  if (!Number.isFinite(current_monthly) || current_monthly <= 0) return NextResponse.json({ error: 'אומגילטיגער יעצטיגער מאנאט־ביל.' }, { status: 400 })
  if (!Number.isFinite(desired_monthly) || desired_monthly < 0) return NextResponse.json({ error: 'אומגילטיגער געוואלטער מאנאט־ביל.' }, { status: 400 })

  const draft = buildBillNegotiationDraft({ provider_name, bill_type, current_monthly, desired_monthly, account_hint, notes })

  // Emit "Ready to Send" notification (best-effort)
  try {
    const db = await readGlobalNotifications()
    const next = appendGlobal(db, {
      id: `notif-bill-${bill_type}-${provider_name}-${Math.random().toString(16).slice(2)}`,
      kind: 'bill_ready',
      title: `ביל־נעגאציע · גרייט צו שיקן (${provider_name})`,
      body: `דראפט איז גרייט: $${Math.round(current_monthly)} → $${Math.round(desired_monthly)} ציל.`,
      created_at: new Date().toISOString(),
      meta: { provider_name, bill_type, current_monthly, desired_monthly },
    })
    await writeGlobalNotifications(next)
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, draft })
}


