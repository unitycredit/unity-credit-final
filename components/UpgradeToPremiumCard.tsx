'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { ArrowRight, BadgePercent, Check, Crown, Lock, ShieldCheck, Sparkles, TrendingUp, Loader2 } from 'lucide-react'
import { getLoginHref } from '@/lib/local-auth-bypass'

function money(cents: number) {
  const n = Math.max(0, Number(cents) || 0)
  return `$${(n / 100).toFixed(2)}`
}

function CheckoutFormStripe(props: { amountCents: number; onCompleteHref: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function startTrial() {
    setSubmitting(true)
    setStatus(null)
    try {
      if (!stripe || !elements) return
      const result = await stripe.confirmSetup({ elements, redirect: 'if_required' })
      if (result.error) throw new Error(result.error.message || 'Card setup failed')
      const si: any = (result as any).setupIntent
      const pm = String(si?.payment_method || '').trim()
      if (!pm) throw new Error('Missing payment method')

      const res = await fetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method_id: pm }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Trial start failed')
      setStatus('Trial started (7 days). Redirecting…')
      window.location.href = props.onCompleteHref
    } catch (e: any) {
      setStatus(e?.message || 'Trial failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-black text-white/85">
          <Lock className="h-4 w-4 text-emerald-300" />
          Secure billing
        </div>
        <div className="mt-3">
          <PaymentElement />
        </div>
      </div>

      {status ? <div className="text-sm text-white/70">{status}</div> : null}

      <div className="space-y-2">
        <Button
          type="button"
          className="h-12 w-full font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95"
          disabled={submitting || !stripe || !elements}
          onClick={startTrial}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
          Start 7‑day free trial
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <div className="text-xs text-white/50">
        Card required. You will not be charged for the first 7 days. After trial, billing continues at {money(props.amountCents)} per period unless canceled.
      </div>
    </div>
  )
}

function CheckoutFormDemo(props: { amountCents: number; onCompleteHref: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function startTrialDemo() {
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/billing/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed')
      setStatus('Trial started (7 days). Redirecting…')
      window.location.href = props.onCompleteHref
    } catch (e: any) {
      setStatus(e?.message || 'Trial failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function simulateChargeAfterTrial() {
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed')
      setStatus('Premium activated. Redirecting…')
      window.location.href = props.onCompleteHref
    } catch (e: any) {
      setStatus(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-black text-white/85">
          <Lock className="h-4 w-4 text-emerald-300" />
          Secure billing
        </div>
        <div className="mt-3 text-sm text-white/65">
          Stripe keys aren’t configured for this environment. Use the demo buttons below to simulate Trial → Paid.
        </div>
      </div>

      {status ? <div className="text-sm text-white/70">{status}</div> : null}

      <div className="space-y-2">
        <Button
          type="button"
          className="h-12 w-full font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95"
          disabled={submitting}
          onClick={startTrialDemo}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
          Start 7‑day free trial (demo)
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full bg-white/5 border-white/10 text-white hover:bg-white/10"
          onClick={simulateChargeAfterTrial}
          disabled={submitting}
        >
          Simulate charge after trial (demo)
        </Button>
      </div>

      <div className="text-xs text-white/50">
        Card required. You will not be charged for the first 7 days. After trial, billing continues at {money(props.amountCents)} per period unless canceled.
      </div>
    </div>
  )
}

export default function UpgradeToPremiumCard(props: { forceDemo?: boolean; onCompleteHref?: string; className?: string }) {
  const onCompleteHref = props.onCompleteHref || '/premium/success'
  const forceDemo = Boolean(props.forceDemo)

  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [clientSecret, setClientSecret] = useState<string>('')
  const [amountCents, setAmountCents] = useState<number>(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
  const [demo, setDemo] = useState<boolean>(forceDemo)

  const stripePromise = useMemo(() => {
    if (forceDemo) return null
    const pk = String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
    return pk ? loadStripe(pk) : null
  }, [forceDemo])

  useEffect(() => {
    if (forceDemo) {
      setClientSecret('demo_setup_secret')
      setDemo(true)
      setAuthRequired(false)
      setLoading(false)
      return
    }

    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/billing/create-trial-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const json = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setAuthRequired(true)
          throw new Error('Please log in to start a trial.')
        }
        if (!res.ok) throw new Error(json?.error || 'Failed to initialize billing')
        setClientSecret(String(json?.client_secret || ''))
        setAmountCents(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
        setDemo(Boolean(json?.demo))
        setAuthRequired(false)
      } catch {
        setClientSecret('demo_setup_secret')
        setAmountCents(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
        setDemo(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [forceDemo])

  return (
    <Card
      className={[
        'border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-white/5 to-white/[0.02] text-white',
        props.className || '',
      ].join(' ')}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-amber-300" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/60">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Upgrade to Enterprise / Unity Credit
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                7‑Day Free Trial
              </span>
              <span className="text-xs text-white/60">
                Then <span className="font-mono text-white/80">{money(amountCents)}</span> / month · Cancel anytime
              </span>
            </div>
            <CardTitle className="mt-3 text-3xl md:text-4xl font-black tracking-tight">
              Activate Unity Credit Processing
            </CardTitle>
            <div className="mt-2 text-sm text-white/70">
              Get access to 5‑Node Consensus Logic, Auto‑Negotiator, and Automated Savings Nodes — engineered for measurable savings and clean reporting.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
              <TrendingUp className="h-4 w-4" />
              Savings ROI
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/10 to-white/[0.03] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/15 border border-amber-300/30">
              <BadgePercent className="h-4 w-4 text-amber-300" />
            </span>
            <div className="text-sm text-white/80">
              <div className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                Most users save 15x their subscription cost in the first month
              </div>
              <div className="text-xs text-white/55 mt-2">Claim shown in demo. Results depend on category coverage and bill profile.</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              title: '5‑Node Consensus Logic',
              desc: 'Multi-node verification before decisions ship. Higher accuracy, fewer false positives.',
            },
            {
              title: 'Auto‑Negotiator',
              desc: 'Drafts, counter-offers, and “Ready‑to‑Send” letters in minutes.',
            },
            {
              title: '25%+ Deal Hunter',
              desc: 'Finds major drops and switches based on your spending signals.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-base font-black">{f.title === '25%+ Deal Hunter' ? 'Automated Savings Nodes' : f.title}</div>
                <Check className="h-4 w-4 text-emerald-300 mt-1 shrink-0" />
              </div>
              <div className="text-xs text-white/55 mt-2">
                {f.title === '25%+ Deal Hunter'
                  ? 'Continuous detection of pricing drops and eligible switches based on verified spend signals.'
                  : f.desc}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 text-white/80">
              <Loader2 className="h-4 w-4 animate-spin" />
              Initializing billing…
            </div>
          </div>
        ) : authRequired ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
            <div className="text-sm text-white/80">Please log in to start a trial and manage your subscription.</div>
            <Button
              type="button"
              className="h-11 font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95"
              onClick={() => (window.location.href = getLoginHref())}
            >
              Log in
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {demo || !stripePromise || !clientSecret ? (
              <CheckoutFormDemo amountCents={amountCents} onCompleteHref={onCompleteHref} />
            ) : (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: { theme: 'night', variables: { colorPrimary: '#34d399', borderRadius: '12px' } },
                }}
              >
                <CheckoutFormStripe amountCents={amountCents} onCompleteHref={onCompleteHref} />
              </Elements>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


