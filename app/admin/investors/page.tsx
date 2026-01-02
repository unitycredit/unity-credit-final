import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { createHmac } from 'node:crypto'
import { notFound } from 'next/navigation'
import { resolveAdminSecret } from '@/lib/admin-secret'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function pct(n: number, d: number) {
  if (!d) return '0%'
  return `${Math.round((n / d) * 100)}%`
}

export default async function InvestorsPage() {
  const resolved = resolveAdminSecret(null)
  const secret = resolved.enabled ? resolved.secret : ''
  if (!secret) notFound()

  const token = createHmac('sha256', secret).update('uc_admin_v1').digest('hex')
  const cookieToken = (await cookies()).get('uc_admin')?.value || ''
  if (!cookieToken || cookieToken !== token) notFound()

  // Load metrics from nodejs API route (keeps this page free of node:fs imports).
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  const base = `${proto}://${host}`
  const resp = await fetch(`${base}/api/admin/investors`, {
    headers: { cookie: `uc_admin=${cookieToken}` },
    cache: 'no-store',
  })
  const json: any = await resp.json().catch(() => ({}))
  if (!resp.ok || !json?.ok) notFound()

  const m = json?.metrics || {}
  const v = m?.verification || {}

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#f8fafc] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-3xl font-black text-primary rtl-text text-right">אינוועסטאר־איבערבליק</div>
            <div className="text-sm text-slate-600 rtl-text text-right">
              דאטן־רייכער איבערבליק פאר סקייל־פּלאַנירונג. דערהיינטיקט: {new Date().toLocaleString('he-IL')}
            </div>
          </div>
          <UnityCreditBrandStack size="sm" label="UnityCredit" aria-label="UnityCredit" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-600 rtl-text text-right">גאַנץ ניצערס</div>
            <div className="text-3xl font-black text-primary rtl-text text-right">{m?.total_users ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1 rtl-text text-right">
              {m?.total_users == null ? 'מטריקס זענען נישט בנימצא (סיסטעם־קאנפיגוראציע).' : 'באַזירט אויף Supabase טאבעלע־ציילונג.'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-600 rtl-text text-right">פּראָצעסירטע טראַנזאַקציעס</div>
            <div className="text-3xl font-black text-primary rtl-text text-right">{m?.plaid?.total_transactions ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1 rtl-text text-right">פון באנק־סנאַפּשאַץ (בסט־עפערט)</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-600 rtl-text text-right">מאָנאַטליכע שפּאָר־סומע (30 טעג)</div>
            <div className="text-3xl font-black text-[#00ff00] rtl-text text-right">${m?.monthly_saved_last_30d_sum ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1 rtl-text text-right">פון “שפּאָר־איוואנטס” (סכום).</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-600 rtl-text text-right">פארבונדן באנק־אייטעמס</div>
            <div className="text-3xl font-black text-primary rtl-text text-right">{m?.linked_bank_items ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1 rtl-text text-right">ציילונג פון טוקענס־סטאָר (בסט־עפערט)</div>
          </div>
        </div>

        {/* Scale + flags */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="text-lg font-black text-primary rtl-text text-right">סקייל־קאַפּאַציטעט</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 rtl-text text-right">
              <li>
                - <span className="font-semibold">קאַשינג</span>: {m?.flags?.upstash ? 'אקטיוו (Upstash Redis)' : 'נישט קאנפיגורירט'}
              </li>
              <li>
                - <span className="font-semibold">אודיט־טרייל</span>: {m?.flags?.auditEncrypted ? 'ענקריפּטירט' : 'נישט ענקריפּטירט (AUDIT_LOG_ENC_KEY)'}
              </li>
              <li>
                - <span className="font-semibold">וועריפיקאציע</span>: {v?.totalRuns ? 'אקטיוו' : 'נישט גענוג דאטן'}
              </li>
              <li>
                - <span className="font-semibold">זוך־באזירטע פרייז־טשעק</span>: {m?.flags?.liveSearch ? 'אקטיוו' : 'אויסגעשאַלט'}
              </li>
              <li>
                - <span className="font-semibold">פאָרשטעלונג</span>: שווערע מאָדולן ווערן דינאַמיש געלאָדנט פאר שנעלער ערשטער־לאָד.
              </li>
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 rtl-text text-right">
              באמערקונג: פאר אמת’דיגע הויכע סקייל דארף מען האלטן באנק־דאטא און בודזשעטן פּער־ניצער אין Postgres און נוצן סערווער־קאַשינג/קיו־ריפרעש.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black text-primary rtl-text text-right">פינאַנציעלער סנאַפּשאַץ</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 rtl-text text-right">סך־הכל באַלאַנס (סכום)</span>
                <span className="font-black text-primary">${Number(m?.plaid?.total_balance || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 rtl-text text-right">אינסטיטוציעס (סנאַפּשאַץ)</span>
                <span className="font-semibold text-primary">{Number(m?.plaid?.institutions || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 rtl-text text-right">אודיט־סטאָרידזש</span>
                <span className="font-semibold">{String(v?.storage || '—')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Logic Accuracy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xl font-black text-primary rtl-text text-right">וועריפיקאציע־קוואַליטעט</div>
              <div className="text-sm text-slate-600 rtl-text text-right">אויסגערעכנט פון אודיט־טרייל (לעצטע {Math.min(2000, Number(v?.totalRuns || 0))} ראַנז).</div>
            </div>
            <div className="text-xs text-slate-500">
              Storage: <span className="font-mono">{String(v?.storage || '—')}</span> · Encrypted:{' '}
              <span className="font-mono">{v?.encrypted ? 'yes' : 'no'}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 rtl-text text-right">סאַקסעס</div>
              <div className="text-2xl font-black text-[#00ff00] rtl-text text-right">{Number(v?.okRuns || 0)}</div>
              <div className="text-xs text-slate-500 rtl-text text-right">{pct(Number(v?.okRuns || 0), Number(v?.totalRuns || 0))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 rtl-text text-right">בלאָקירט</div>
              <div className="text-2xl font-black text-rose-700 rtl-text text-right">{Number(v?.blockedRuns || 0)}</div>
              <div className="text-xs text-slate-500 rtl-text text-right">{pct(Number(v?.blockedRuns || 0), Number(v?.totalRuns || 0))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 rtl-text text-right">מערהייט־וועריפיצירט</div>
              <div className="text-2xl font-black text-primary rtl-text text-right">{Number(v?.majorityRuns || 0)}</div>
              <div className="text-xs text-slate-500 rtl-text text-right">{pct(Number(v?.majorityRuns || 0), Number(v?.totalRuns || 0))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 rtl-text text-right">איינשטימיג</div>
              <div className="text-2xl font-black text-primary rtl-text text-right">{Number(v?.unanimousRuns || 0)}</div>
              <div className="text-xs text-slate-500 rtl-text text-right">{pct(Number(v?.unanimousRuns || 0), Number(v?.totalRuns || 0))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-600 rtl-text text-right">סעקיוריטי־בלאָקס</div>
              <div className="text-2xl font-black text-amber-700 rtl-text text-right">{Number(v?.securityBlocks || 0)}</div>
              <div className="text-xs text-slate-500 rtl-text text-right">{pct(Number(v?.securityBlocks || 0), Number(v?.totalRuns || 0))}</div>
            </div>
          </div>

          <div className="mt-5 text-xs text-slate-500 rtl-text text-right">
            “וועריפיקאציע־קוואַליטעט” מיינט אז די אינערליכע וועריפיקאציע האט דערגרייכט די נויטיגע באשטעטיגונגען אָן אויסלösen דעם סעקיוריטי־אובררייד.
          </div>
        </div>
      </div>
    </div>
  )
}


