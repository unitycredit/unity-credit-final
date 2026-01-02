'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePremiumStatus } from '@/components/usePremiumStatus'
import { Lock, Crown } from 'lucide-react'

export default function PremiumGate(props: { children: ReactNode; title: string; subtitle: string }) {
  const premium = usePremiumStatus()
  const unlocked = premium.status?.tier === 'premium' || premium.status?.tier === 'trial'

  if (premium.loading) return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading…</div>
  if (unlocked) return <>{props.children}</>

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-[#0b1220] to-[#020617] text-white p-5 overflow-hidden relative">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_55%)]" />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-black">
          <Lock className="h-4 w-4 text-amber-300" />
          {props.title}
        </div>
        <div className="mt-1 text-sm text-white/75">{props.subtitle}</div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Link href="/premium">
            <Button type="button" className="h-10 font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95">
              <Crown className="h-4 w-4 mr-2" />
              Start 7‑day free trial
            </Button>
          </Link>
          <Button type="button" variant="outline" className="h-10 bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={() => premium.refresh()}>
            Refresh status
          </Button>
        </div>
      </div>
    </div>
  )
}


