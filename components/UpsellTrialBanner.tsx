'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePremiumStatus } from '@/components/usePremiumStatus'
import { Crown, ArrowRight, ShieldCheck } from 'lucide-react'
import { toFiniteNumber } from '@/lib/finance/number'

export default function UpsellTrialBanner() {
  const premium = usePremiumStatus()
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    if (premium.status?.tier !== 'free') return
    ;(async () => {
      const res = await fetch('/api/monthly-savings-summary/latest')
      const json = await res.json().catch(() => ({}))
      setSummary(json)
    })()
  }, [premium.status?.tier])

  const weekly = useMemo(() => {
    const monthly = toFiniteNumber(summary?.potential?.monthly, 0)
    // Convert monthly to weekly with a simple factor (52/12).
    return Math.max(0, Math.round(monthly / (52 / 12)))
  }, [summary])

  if (premium.loading) return null
  if (premium.status?.tier !== 'free') return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-[#0b1220] to-[#020617] text-white p-5 overflow-hidden relative">
      <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.20),transparent_55%)]" />
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_bottom,rgba(52,211,153,0.18),transparent_55%)]" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/60">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            פרעמיום־פּרוב
          </div>
          <div className="mt-2 text-lg md:text-xl font-black tracking-tight rtl-text text-right">
            איר קענט היינט שוין געקענט שפּאָרן <span className="font-mono text-[#00ff00]">${weekly}</span> די וואך מיט אונזער 5־מיינדס לאָגיק.
          </div>
          <div className="mt-1 text-sm text-white/70 rtl-text text-right">
            הייבט אָן א <span className="font-semibold text-white">7־טאָג פרייע פּרוב</span> יעצט (קארטל נויטיג, קיין טשאַרזש פאר 7 טעג).
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/premium">
            <Button type="button" className="h-11 font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95">
              <Crown className="h-4 w-4 mr-2" />
              הייב אָן די פרייע פּרוב
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}


