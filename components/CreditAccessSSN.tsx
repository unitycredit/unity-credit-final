'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Eye, EyeOff, Lock, ShieldCheck, FileText, TrendingUp, AlertTriangle } from 'lucide-react'

type Props = {
  fetchReport?: (last4: string) => Promise<{
    score: number
    status: 'Good' | 'Fair' | 'Excellent'
    utilizationPct: number
    totalAccounts: number
    negativeItems: Array<{ type: string; detail: string; impact: string }>
    notes: string[]
  }>
}

export default function CreditAccessSSN({ fetchReport }: Props) {
  const { toast } = useToast()
  const [show, setShow] = useState(false)
  const [last4, setLast4] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState<null | {
    score: number
    status: 'Good' | 'Fair' | 'Excellent'
    utilizationPct: number
    totalAccounts: number
    negativeItems: Array<{ type: string; detail: string; impact: string }>
    notes: string[]
  }>(null)

  const isValid = useMemo(() => /^\d{4}$/.test(last4), [last4])

  const handleSubmit = async () => {
    if (!isValid || submitting) return
    setSubmitting(true)
    try {
      // IMPORTANT: last4 stays in memory only (no localStorage, no logs).
      let nextReport = null as any
      if (fetchReport) {
        nextReport = await fetchReport(last4)
      } else {
        await new Promise((r) => setTimeout(r, 900))
        nextReport = {
          score: 732,
          status: 'Good',
          utilizationPct: 28,
          totalAccounts: 5,
          negativeItems: [{ type: 'הארדע אינקוויירי', detail: 'קרעדיט טשעק - 2025', impact: 'נידעריג' }],
          notes: [
            'אויטניצאציע אונטער 30% העלפט האלטן א שטארקן סקאר.',
            'צאל פונקטליך און האלט די היסטאריע ריין.',
            'פוקוס אויף רעדוצירן הויך-APR באלאנסן.',
          ],
        }
      }

      setReport(nextReport)
      toast({
        title: 'באשטעטיגט',
        description: 'א מוסטער־קרעדיט רעפארט איז גרייט. (טעסט-מאָדע)',
      })
      setLast4('')
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען. ביטע פרובירט נאכאמאל.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-primary to-[#003d7a]" />
      <CardHeader className="pb-4">
        <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          קרעדיט אקסעס
        </CardTitle>
        <p className="rtl-text text-right text-sm text-muted-foreground">
          אריינלייגן די לעצטע 4 ציפערן פונעם סאציאל־נומער (SSN) כדי צו צוגרייטן א זיכערע קרעדיט־אינטעגראַציע.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ssnLast4" className="rtl-text font-semibold text-primary">
            לעצטע 4 ציפערן (SSN)
          </Label>
          <div className="relative">
            <Input
              id="ssnLast4"
              dir="rtl"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              type={show ? 'text' : 'password'}
              placeholder="••••"
              value={last4}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setLast4(v)
              }}
              className="h-12 pr-10 border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
              aria-describedby="ssnHelp"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold transition-colors"
              aria-label={show ? 'Hide' : 'Show'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div id="ssnHelp" className="rtl-text text-right text-xs text-muted-foreground flex items-start gap-2">
            <Lock className="h-4 w-4 text-gold mt-0.5" />
            <span>
              זיכערהייט: די ציפערן ווערן נישט געשפארט אין בראוזער, נישט געשיקט אָן באשטעטיגונג, און נישט געסאוועט אין קלאָר־טעקסט.
            </span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-primary font-semibold shadow-lg hover:shadow-gold/40"
        >
          {submitting ? 'ביטע ווארט...' : 'באשטעטיגן און פארזעצן'}
        </Button>

        {report && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between rtl-text">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-bold text-primary rtl-text">קרעדיט רעפארט (מוסטער)</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {report.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 bg-[#f8fafc] p-3 rtl-text text-right">
                <p className="text-xs text-muted-foreground rtl-text">סקאר</p>
                <p className="text-2xl font-black text-primary">{report.score}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-[#f8fafc] p-3 rtl-text text-right">
                <p className="text-xs text-muted-foreground rtl-text">אויטניצאציע</p>
                <p className="text-2xl font-black text-primary">{report.utilizationPct}%</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-[#f8fafc] p-3 rtl-text text-right">
                <p className="text-xs text-muted-foreground rtl-text">אקאַונטן</p>
                <p className="text-2xl font-black text-primary">{report.totalAccounts}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <div className="flex items-start gap-2 rtl-text text-right">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-primary rtl-text">וויכטיגע פוינטס</p>
                  <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground rtl-text">
                    {report.notes.map((n, i) => (
                      <li key={i} className="rtl-text">{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="font-semibold text-primary rtl-text text-right mb-2">נעגאטיווע אייטעמס</p>
              {report.negativeItems.length === 0 ? (
                <p className="text-sm text-muted-foreground rtl-text text-right">
                  קיין נעגאטיווע אייטעמס נישט געפונען.
                </p>
              ) : (
                <div className="space-y-2">
                  {report.negativeItems.map((it, idx) => (
                    <div key={idx} className="rounded-lg border border-rose-100 bg-rose-50/40 p-3 rtl-text text-right">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary rtl-text">{it.type}</span>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-800">
                          {it.impact}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground rtl-text mt-1">{it.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-start gap-2 rtl-text text-right">
                <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5" />
                <p className="text-sm text-muted-foreground rtl-text">
                  קומעדיגע שריט: האלט אונטער 30% אויטניצאציע און צאל מער אויף די טייערסטע אינטערעסט קארטלעך.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


