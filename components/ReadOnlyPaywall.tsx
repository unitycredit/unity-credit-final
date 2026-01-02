'use client'

import { ReactNode, createContext, useContext } from 'react'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePremiumStatus } from '@/components/usePremiumStatus'

type ReadOnlyPaywallContextValue = {
  unlocked: boolean
  paywallBox: ReactNode | null
}

const ReadOnlyPaywallContext = createContext<ReadOnlyPaywallContextValue | null>(null)

export function useReadOnlyPaywall() {
  return useContext(ReadOnlyPaywallContext)
}

type Props = {
  children: ReactNode
  /** Main section title rendered inside the blue header bar (right side, RTL-friendly). */
  sectionTitle?: ReactNode
  title?: string
  subtitle?: string
  upgradeHref?: string
  /** Visual theme for the header bar. */
  theme?: 'gold' | 'blue'
  /** If set, renders the paywall notice/CTA under the header aligned to the left. */
  paywallPlacement?: 'header-right' | 'below-left' | 'none'
}

export default function ReadOnlyPaywall({
  children,
  sectionTitle,
  title = 'Read‑Only',
  subtitle = 'Upgrade to use interactive features.',
  upgradeHref = '/api/checkout',
  theme = 'gold',
  paywallPlacement = 'header-right',
}: Props) {
  const premium = usePremiumStatus()
  const tier = premium.status?.tier || 'free'
  const unlocked = tier === 'pro' || tier === 'trial' || tier === 'premium'

  if (premium.loading) return <>{children}</>

  const isBlue = theme === 'blue'
  const headerWrapClass = isBlue ? 'bg-[#001f3f] text-white' : 'bg-[#D4AF37] text-primary'
  const headerAccentClass = isBlue ? 'bg-[#001f3f]' : 'bg-[#D4AF37]'
  // Match the dashboard "Credit Card" section header bar exactly.
  const headerPadClass = isBlue ? 'px-4 py-7' : 'px-4 py-4' // gold stays thicker
  const paywallBoxClass = isBlue ? 'border-white/15 bg-white/10' : 'border-primary/20 bg-white/40'
  const paywallTitleClass = isBlue ? 'text-white' : 'text-primary'
  const paywallSubClass = isBlue ? 'text-white/80' : 'text-primary/80'
  const titleTextClass = isBlue ? 'text-white' : 'text-primary'
  const titleSubtleClass = isBlue ? 'text-white/80' : 'text-primary/70'

  const PaywallBox =
    !unlocked ? (
      <div className="shrink-0 uc-paywall relative z-20">
        <div className={['rounded-xl border px-3 py-2', paywallBoxClass].join(' ')}>
          <div className="flex items-center gap-2">
            <Lock className={['h-4 w-4', isBlue ? 'text-white/90' : 'text-primary'].join(' ')} />
            <div className={['text-xs font-black', paywallTitleClass].join(' ')}>{title}</div>
          </div>
          <div className={['mt-1 text-[11px] max-w-[300px]', paywallSubClass].join(' ')}>{subtitle}</div>
          <div className="mt-2 flex justify-start">
            <Button
              type="button"
              className={
                isBlue
                  ? 'h-9 font-black bg-white text-[#001f3f] hover:bg-white/90'
                  : 'h-9 font-black bg-gradient-to-r from-[#001f3f] to-[#003d7a] hover:from-[#003d7a] hover:to-[#0056b3] text-gold'
              }
              onClick={async () => {
                fetch('/api/notifications/savings/subscribe', { method: 'POST' }).catch(() => null)
                window.location.href = upgradeHref
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    ) : null

  const PaywallHeaderTrigger =
    !unlocked ? (
      <div className="shrink-0 uc-paywall relative z-20">
        <Button
          type="button"
          className={
            isBlue
              ? 'h-9 px-3 font-black border border-white/25 bg-white/10 text-white hover:bg-white/15 shadow-sm'
              : 'h-9 px-3 font-black bg-gradient-to-r from-[#001f3f] to-[#003d7a] hover:from-[#003d7a] hover:to-[#0056b3] text-gold'
          }
          onClick={async () => {
            fetch('/api/notifications/savings/subscribe', { method: 'POST' }).catch(() => null)
            window.location.href = upgradeHref
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade to Pro
        </Button>
      </div>
    ) : null

  const Header = sectionTitle ? (
    <div className="rtl-text border-0 shadow-xl overflow-hidden rounded-2xl">
      <div className={['h-1.5 w-full', headerAccentClass].join(' ')} />
      <div className={[headerWrapClass, headerPadClass].join(' ')}>
        <div className="relative flex items-center justify-center text-center">
          <div dir="ltr" className={['text-2xl font-black tracking-tight', titleTextClass].join(' ')}>
            {sectionTitle}
          </div>
          <div className={['sr-only', titleSubtleClass].join(' ')}>.</div>

          {/* Right: paywall trigger inside the header bar (keeps title centered) */}
          {!unlocked && paywallPlacement === 'header-right' ? (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-end">
              {PaywallHeaderTrigger}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null

  return (
    <ReadOnlyPaywallContext.Provider value={{ unlocked, paywallBox: PaywallBox }}>
      <div className={sectionTitle ? 'space-y-6' : 'space-y-3'}>
        {Header}

        {/* Paywall trigger under the header (left side) */}
        {!unlocked && sectionTitle && paywallPlacement === 'below-left' ? (
          <div className="flex items-start justify-start">{PaywallBox}</div>
        ) : null}

        {/* Backward-compatible fallback: if no header title provided, keep original notice above content */}
        {!unlocked && !sectionTitle ? (
          <div className="flex items-start justify-start">
            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-700" />
                <div className="text-xs font-black text-slate-900">{title}</div>
              </div>
              <div className="mt-1 text-[11px] text-slate-700 max-w-[280px]">{subtitle}</div>
              <div className="mt-2 flex justify-start">
                <Button
                  type="button"
                  className="h-9 font-black bg-gradient-to-r from-[#001f3f] to-[#003d7a] hover:from-[#003d7a] hover:to-[#0056b3] text-white"
                  onClick={async () => {
                    fetch('/api/notifications/savings/subscribe', { method: 'POST' }).catch(() => null)
                    window.location.href = upgradeHref
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {unlocked ? (
          <>{children}</>
        ) : (
          // Keep content fully visible, but disable interactions (buttons/inputs/selects)
          <div className="uc-readonly" aria-disabled="true">
            {children}
          </div>
        )}
      </div>
    </ReadOnlyPaywallContext.Provider>
  )
}


