'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePremiumStatus } from '@/components/usePremiumStatus'

export default function ProGate(props: { children: ReactNode; title: string; subtitle: string }) {
  const premium = usePremiumStatus()
  const tier = premium.status?.tier || 'free'
  const unlocked = tier === 'pro' || tier === 'premium' || tier === 'trial'

  if (premium.loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading…</div>
  }

  return (
    <div className="relative">
      {!unlocked ? (
        <div className="mb-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-[#0b1220] to-slate-900 text-white p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black">
              <Lock className="h-4 w-4 text-amber-300" />
              <span className="truncate">{props.title}</span>
            </div>
            <div className="text-xs text-white/70 mt-1">{props.subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/api/checkout">
              <Button type="button" className="h-10 font-black bg-gradient-to-r from-sky-300 to-emerald-300 text-slate-950 hover:opacity-95">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </Link>
            <Button type="button" variant="outline" className="h-10 bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={() => premium.refresh()}>
              Refresh
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={
          unlocked
            ? ''
            : [
                // keep content visible, but disable interactions inside (read-only paywall)
                '[&_button]:pointer-events-none [&_button]:opacity-60 [&_button]:cursor-not-allowed',
                '[&_input]:pointer-events-none [&_input]:opacity-70 [&_input]:cursor-not-allowed',
                '[&_select]:pointer-events-none [&_select]:opacity-70 [&_select]:cursor-not-allowed',
                '[&_textarea]:pointer-events-none [&_textarea]:opacity-70 [&_textarea]:cursor-not-allowed',
                '[&_a]:pointer-events-none [&_a]:opacity-70',
                'relative',
              ].join(' ')
        }
      >
        {!unlocked ? (
          <div className="absolute top-3 right-3 z-10 rounded-full bg-slate-900/70 border border-white/10 px-3 py-1 text-[11px] font-black text-white">
            Read‑Only: Upgrade to use
          </div>
        ) : null}
        {props.children}
      </div>
    </div>
  )
}


