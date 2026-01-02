import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/server-rate-limit'
import { createAdminClient } from '@/lib/supabase-admin'
import { queueRawEmail } from '@/lib/email-queue'
import { readSavingsSubscribers, writeSavingsSubscribers } from '@/lib/savings-email-subscribers'

export const runtime = 'nodejs'

function hasCronAuth(req: NextRequest) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const h = String(req.headers.get('x-uc-cron-secret') || '').trim()
  return Boolean(h && h === secret)
}

function ym(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function sumMonthlyFromRecommendations(recs: any[]) {
  const items = Array.isArray(recs) ? recs : []
  let total = 0
  for (const r of items) {
    const v = Number((r as any)?.monthly_savings || 0)
    if (Number.isFinite(v) && v > 0) total += v
  }
  return Math.round(total)
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, 'API_REQUESTS')
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: rl.headers })
  if (!hasCronAuth(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: rl.headers })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500, headers: rl.headers })

  const now = new Date()
  const nowYM = ym(now)
  const db = await readSavingsSubscribers()
  const subs = Object.values(db.subscribers || {})

  const processed: any[] = []

  for (const s of subs) {
    const user_id = String(s.user_id || '').trim()
    const to = String(s.email || '').trim()
    if (!user_id || !to) continue

    // Send at most once per month.
    if (String(s.last_sent_ym || '') === nowYM) {
      processed.push({ user_id, to, ok: true, skipped: true, reason: 'already_sent_this_month' })
      continue
    }

    // Pull latest snapshot (best-effort). If not available, skip.
    const snapRes = await admin
      .from('user_savings_snapshots')
      .select('payload, created_at')
      .eq('user_id', user_id)
      .eq('kind', 'savings_finder')
      .order('created_at', { ascending: false })
      .limit(1)

    const snap = Array.isArray((snapRes as any)?.data) ? (snapRes as any).data[0] : null
    const recs = (snap as any)?.payload?.recommendations
    const potentialMonthly = sumMonthlyFromRecommendations(Array.isArray(recs) ? recs : [])

    const subject = `UnityCredit — Monthly Savings Report: $${potentialMonthly}/mo potential`
    const text = [
      'Monthly Savings Report',
      '',
      `Potential Savings: $${potentialMonthly}/mo`,
      '',
      'UnityCredit provides financial insights for informational purposes only and does not constitute official financial advice.',
    ].join('\n')

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
        <h2 style="margin:0 0 10px 0;">Monthly Savings Report</h2>
        <div style="margin:0 0 8px 0;"><strong>Potential Savings:</strong> <span style="font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;">$${potentialMonthly}/mo</span></div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <div style="font-size:12px;color:#64748b;">
          UnityCredit provides financial insights for informational purposes only and does not constitute official financial advice.
        </div>
      </div>
    `.trim()

    const dispatched = await queueRawEmail({
      to,
      subject,
      text,
      html,
      meta: { kind: 'monthly_savings_report', user_id, ym: nowYM, potential_monthly: potentialMonthly },
      jobId: `msr:${user_id}:${nowYM}`,
    })

    if ((dispatched as any)?.ok === false) {
      processed.push({ user_id, to, ok: false, error: (dispatched as any)?.error || 'dispatch_failed' })
      continue
    }

    db.subscribers[user_id] = { ...db.subscribers[user_id], last_sent_ym: nowYM }
    processed.push({ user_id, to, ok: true, queued: dispatched.queued, sent: dispatched.sent, potential_monthly: potentialMonthly })
  }

  await writeSavingsSubscribers(db)
  return NextResponse.json({ ok: true, processed, total: processed.length }, { headers: { ...rl.headers, 'Cache-Control': 'no-store' } })
}


