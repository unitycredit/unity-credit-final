'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, AlertTriangle, ExternalLink, Mail, CheckCircle2, Shield, RefreshCw, ShieldCheck, Bell, TrendingUp } from 'lucide-react'
import { toFiniteNumber } from '@/lib/finance/number'

type RecurringBill = {
  merchant: string
  category: string
  occurrences: number
  monthly_estimate: number
  last_date?: string
}

type Props = {
  disclaimerYI: string
  onApplySavings?: (items: Array<{ target_budget_key?: string; category?: string; monthly_savings: number; title_yi: string }>) => void
}

type SavingsRecommendation = {
  title_yi: string
  category?: string
  merchant?: string
  monthly_savings: number
  provider_name?: string
  provider_url?: string
  email_subject_yi?: string
  email_body_yi?: string
  target_budget_key?: string
}

export default function ServiceOptimizationCenter({ disclaimerYI, onApplySavings }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<string | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailing, setEmailing] = useState<Record<string, boolean>>({})
  const [recurring, setRecurring] = useState<RecurringBill[]>([])
  const [result, setResult] = useState<string>('')
  const [verification, setVerification] = useState<any>(null)
  const [blocked, setBlocked] = useState(false)
  const [recommendations, setRecommendations] = useState<SavingsRecommendation[]>([])
  const [applied, setApplied] = useState<Record<string, boolean>>({})
  const [seen, setSeen] = useState<Record<string, boolean>>({})

  const badge = useMemo(() => {
    const ok = Number(verification?.ok_reviews || 0) === 5 && Number(verification?.approvals || 0) >= 4
    return { ok, label: ok ? 'Verified by Unity Protocol' : 'Analysis in progress' }
  }, [verification])

  async function loadLive() {
    if (liveLoading) return
    setLiveLoading(true)
    try {
      const resp = await fetch('/api/optimization/latest', { method: 'GET' })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) return

      const r = json?.result || null
      if (r?.ok) {
        setRecurring(Array.isArray(r?.recurring_bills) ? r.recurring_bills : [])
        setResult(String(r?.final || ''))
        setVerification(r?.verification || null)
        setRecommendations(Array.isArray(r?.recommendations) ? r.recommendations : [])
        setLiveUpdatedAt(String(json?.updated_at || '') || null)

        // Load "seen" state (silent alerts)
        try {
          const raw = window.localStorage.getItem('uc_opt_seen_v1') || ''
          const parsed = raw ? JSON.parse(raw) : {}
          if (parsed && typeof parsed === 'object') setSeen(parsed)
        } catch {
          // ignore
        }
      }
    } finally {
      setLiveLoading(false)
    }
  }

  // Lightweight polling for live results (reads cached snapshot; safe for high traffic)
  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem('uc_opt_email_to_v1') || ''
      if (savedEmail) setEmailTo(savedEmail)
    } catch {
      // ignore
    }
    loadLive()
    const id = window.setInterval(() => {
      loadLive()
    }, 15000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unseenCount = useMemo(() => {
    const ids = recommendations.map((r) => `${r.title_yi}-${Number(r.monthly_savings || 0)}`)
    return ids.filter((id) => !seen[id]).length
  }, [recommendations, seen])

  function markSeenAll() {
    try {
      const next: Record<string, boolean> = { ...seen }
      for (const r of recommendations) {
        const id = `${r.title_yi}-${Number(r.monthly_savings || 0)}`
        next[id] = true
      }
      setSeen(next)
      window.localStorage.setItem('uc_opt_seen_v1', JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  async function sendToEmail(offer: SavingsRecommendation) {
    const id = `${offer.title_yi}-${Number(offer.monthly_savings || 0)}`
    if (emailing[id]) return
    setEmailing((p) => ({ ...p, [id]: true }))
    try {
      if (emailTo) {
        try {
          window.localStorage.setItem('uc_opt_email_to_v1', emailTo)
        } catch {
          // ignore
        }
      }

      const resp = await fetch('/api/optimization/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo || undefined, offer }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || 'עס איז נישט געלונגען צו לייגן אין אימעיל־קיּוּ')

      toast({
        title: 'געשיקט צו אימעיל',
        description: json?.queued ? 'עס איז אריין אין די קיּוּ.' : 'דאס איז שוין געשיקט געווארן פריער.',
      })
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען צו שיקן צו אימעיל.',
        variant: 'destructive',
      })
    } finally {
      setEmailing((p) => ({ ...p, [id]: false }))
    }
  }

  async function run() {
    if (loading) return
    setLoading(true)
    setBlocked(false)
    try {
      if (!recurring.length) {
        await loadLive()
      }
      const bills = (recurring || []).slice(0, 120)
      if (!bills.length) throw new Error('קיין ביל־דאטא איז נישט בנימצא. ביטע פרובירט נאכאמאל אין א מינוט.')

      const resp = await fetch('/api/brain/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bills, disclaimer_yi: disclaimerYI }),
      })
      const json = await resp.json().catch(() => ({}))
      if (resp.status === 202 && json?.pending) {
        // Quiet Mode: do not show downtime/errors to the user.
        setResult('Analysis in progress')
        setVerification(null)
        setRecommendations([])
        return
      }
      if (!resp.ok) {
        setBlocked(Boolean(json?.blocked || json?.details?.blocked))
        throw new Error(json?.error || 'אפטימיזאציע־טעות')
      }
      setRecurring(Array.isArray(json?.recurring_bills) ? json.recurring_bills : [])
      setResult(String(json?.final || ''))
      setVerification(json?.verification || null)
      setRecommendations(Array.isArray(json?.recommendations) ? json.recommendations : [])
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען צו געפינען סאווינגס.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
      <CardHeader className="pb-3 rtl-text text-right">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2 justify-end">
              <Shield className="h-5 w-5 text-emerald-700" />
              <span className="dev-only-icon" aria-hidden="true">
                <TrendingUp className="h-5 w-5" />
              </span>
              סערוויס־אפטימיזאציע <span className="text-slate-500 font-semibold">(אפטימיזאציע־צענטער)</span>
            </CardTitle>
            <p className="rtl-text text-sm text-muted-foreground mt-1">
              לויפט 24/7 אויף דער סערווער און גיט אייך רעכענונג־באזירטע רעזולטאטן פון אייערע טראַנזאַקציעס (נאָר־לייענען).
            </p>
          </div>
          <div
            className={[
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border',
              badge.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200',
            ].join(' ')}
            title="Source details are intentionally hidden"
          >
            {badge.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="rtl-text">{badge.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="rtl-text text-right space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 rtl-text">
            <Bell className="h-4 w-4 text-primary" />
            <div className="text-sm font-black text-primary">אַלערטן</div>
            {unseenCount > 0 ? (
              <div className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-black">
                {unseenCount} ניי
              </div>
            ) : (
              <div className="text-xs text-slate-500">קיין נײַע אָפערס</div>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={markSeenAll} className="h-9">
            מארקן געזען
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="rtl-text text-right">
            <div className="text-sm font-black text-primary">לעבעדיגער סנאַפּשאָט</div>
            <div className="text-xs text-slate-600">
              {liveUpdatedAt ? `דערהיינטיקט: ${new Date(liveUpdatedAt).toLocaleString('he-IL')}` : 'ווארט אויף סערווער־סנאַפּשאָט…'}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={loadLive} disabled={liveLoading} className="h-9">
            {liveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            דערהיינטיקן
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-600 rtl-text text-right mb-2">אימעיל (פאר דעוועלאָפּמענט/טעסט ווען מען איז נישט איינגעשריבן)</div>
          <input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="למשל: you@example.com"
            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            dir="ltr"
          />
        </div>

        <Button
          type="button"
          onClick={run}
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          {loading ? 'לויפט...' : 'לויפט אפטימיזאציע'}
        </Button>

        {blocked ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 rtl-text">
            זיכערהייט־איבעררייד: די אַקציע איז געבלאָקט געוואָרן צוליב אַ פריוואַטקייט/קאָמפּלייענס־ריזיק.
          </div>
        ) : null}

        {recurring.length > 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-3 rtl-text font-bold text-primary">
              רעקארירנדע בילס (העכסטע)
            </div>
            <div className="p-3 space-y-2">
              {recurring.slice(0, 8).map((r) => (
                <div
                  key={`${r.merchant}-${r.category}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="rtl-text text-right">
                    <div className="font-bold text-primary rtl-text">{r.merchant}</div>
                    <div className="text-xs text-muted-foreground rtl-text">
                      {r.category} · {r.occurrences}x · {r.last_date ? `לעצטע: ${r.last_date}` : ''}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="font-black text-primary">${toFiniteNumber(r.monthly_estimate, 0).toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground rtl-text">/ חודש (שאצונג)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {recommendations.length > 0 ? (
          <div className="space-y-3">
            <div className="font-black text-primary rtl-text text-right">אַקציע־קארטן</div>
            {recommendations.map((r) => {
              const key = `${r.title_yi}-${r.monthly_savings}`
              const isApplied = Boolean(applied[key])
              const isEmailing = Boolean(emailing[`${r.title_yi}-${Number(r.monthly_savings || 0)}`])

              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="rtl-text text-right">
                      <div className="font-black text-primary rtl-text">{r.title_yi}</div>
                      <div className="text-xs text-muted-foreground rtl-text mt-1">
                        {r.merchant ? `באזירט אויף: ${r.merchant}` : ''}
                        {r.category ? `${r.merchant ? ' · ' : ''}${r.category}` : ''}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-xs text-muted-foreground rtl-text">שאצונג</div>
                      <div className="text-2xl font-black text-[#00ff00]">${toFiniteNumber(r.monthly_savings, 0).toFixed(0)}/חודש</div>
                    </div>
                  </div>

                  {(r.provider_name || r.provider_url) && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-primary rtl-text text-right">ביליגער פראוויידער (בעסטער־אומשטאַנד)</div>
                      <div className="text-sm text-slate-700 rtl-text text-right mt-1">
                        {r.provider_name || '—'}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    {r.provider_url ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9"
                        onClick={() => window.open(r.provider_url!, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        עפענען לינק
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      disabled={isEmailing}
                      onClick={() => sendToEmail(r)}
                    >
                      {isEmailing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      שיקן צו אימעיל
                    </Button>

                    <Button
                      type="button"
                      className="h-9 bg-primary text-primary-foreground"
                      disabled={isApplied || !onApplySavings}
                      onClick={() => {
                        if (!onApplySavings) return
                        onApplySavings([
                          {
                            target_budget_key: r.target_budget_key,
                            category: r.category,
                            monthly_savings: Number(r.monthly_savings || 0),
                            title_yi: r.title_yi,
                          },
                        ])
                        // Log for global analytics (best-effort)
                        fetch('/api/savings-finder/apply', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            monthly_savings: Number(r.monthly_savings || 0),
                            title_yi: r.title_yi,
                            target_budget_key: r.target_budget_key,
                            category: r.category,
                          }),
                        }).catch(() => null)
                        setApplied((p) => ({ ...p, [key]: true }))
                        toast({ title: 'אנגעלייגט', description: 'די סאווינגס איז איינגעשטעלט אין דעם בודזשעט.' })
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {isApplied ? 'אנגעלייגט' : 'לייג אַרײַן אין בודזשעט'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : result ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="font-black text-primary rtl-text text-right">אָפּטימיזאַציע־רעפארט</div>
            <div className="mt-2 rtl-text text-right text-sm whitespace-pre-wrap text-slate-800">{result}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-muted-foreground rtl-text">
            די אפטימיזאציע־אָפערס וועלן זיך ווייזן דאָ נאָך אַ לויפֿ (אָדער ווען דער סערווער־סנאַפּשאָט איז גרייט).
          </div>
        )}

        <div className="text-xs text-muted-foreground rtl-text text-right">{disclaimerYI}</div>
      </CardContent>
    </Card>
  )
}


