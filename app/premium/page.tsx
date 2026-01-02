'use client'

import { useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { ArrowRight, Check, Crown, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { getLoginHref } from '@/lib/local-auth-bypass'

const STRIPE_PUBLISHABLE_KEY = String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim()
// Best practice: initialize Stripe once (outside component render)
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

function money(cents: number) {
  const n = Math.max(0, Number(cents) || 0)
  return `$${(n / 100).toFixed(2)}`
}

function CheckoutForm(props: { amountCents: number; onCompleteHref: string }) {
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
      <div className="rounded-2xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white/85">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          Secure billing
        </div>
        <div className="mt-3">
          <PaymentElement />
        </div>
      </div>

      {status ? <div className="text-sm text-muted-foreground dark:text-white/70">{status}</div> : null}

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

      <div className="text-xs text-muted-foreground dark:text-white/50">
        Card required. You will not be charged for the first 7 days. After trial, billing continues at {money(props.amountCents)} per period unless canceled.
      </div>
    </div>
  )
}

function DemoCheckout(props: { amountCents: number; onCompleteHref: string }) {
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
      setStatus('Enterprise access enabled. Redirecting…')
      window.location.href = props.onCompleteHref
    } catch (e: any) {
      setStatus(e?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2 text-sm font-black text-foreground dark:text-white/85">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
          Secure billing
        </div>
        <div className="mt-3 text-sm text-muted-foreground dark:text-white/65">
          Stripe isn’t configured for this environment. Configure <span className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span> to enable live checkout.
        </div>
      </div>

      {status ? <div className="text-sm text-muted-foreground dark:text-white/70">{status}</div> : null}

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
          className="h-11 w-full"
          onClick={simulateChargeAfterTrial}
          disabled={submitting}
        >
          Simulate charge after trial (demo)
        </Button>
      </div>

      <div className="text-xs text-muted-foreground dark:text-white/50">
        Card required. You will not be charged for the first 7 days. After trial, billing continues at {money(props.amountCents)} per period unless canceled.
      </div>
    </div>
  )
}

export default function PremiumPage() {
  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [clientSecret, setClientSecret] = useState<string>('')
  const [amountCents, setAmountCents] = useState<number>(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
  const [demo, setDemo] = useState<boolean>(false)
  const [stripeUnavailable, setStripeUnavailable] = useState(false)

  const onCompleteHref = '/premium/success'

  const useDemoMode = demo || !stripePromise || !clientSecret

  useEffect(() => {
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

        const nextClientSecret = String(json?.client_secret || '')
        const nextDemo = Boolean(json?.demo)

        // IMPORTANT: Stripe can "exist" (publishable key present) but still fail to initialize (CSP / blocked script / network).
        // When that happens, Stripe Elements hooks throw "Could not find Elements context".
        // Fix: detect initialization failure and fall back to demo checkout instead of mounting <Elements>/<PaymentElement>.
        if (!nextDemo) {
          if (!stripePromise) throw new Error('Stripe is not configured')
          const stripe = await stripePromise
          if (!stripe) throw new Error('Stripe failed to initialize')
          setStripeUnavailable(false)
        }

        setClientSecret(nextClientSecret)
        setAmountCents(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
        setDemo(nextDemo)
        setAuthRequired(false)
      } catch {
        setStripeUnavailable(true)
        setClientSecret('demo_setup_secret')
        setAmountCents(Number(process.env.NEXT_PUBLIC_PREMIUM_PRICE_CENTS || 4900))
        setDemo(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-[#0b1220] dark:to-[#020617] dark:text-white relative">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Enterprise / Unity Credit</div>
              <div className="text-sm text-muted-foreground mt-1">
                Enterprise-grade billing for Unity Credit Processing: 5‑Node Consensus Logic, Auto‑Negotiator, and Automated Savings Nodes.
              </div>
            </div>
          </div>

          <Card className="border-0 shadow-2xl overflow-hidden bg-card text-card-foreground dark:bg-gradient-to-br dark:from-white/5 dark:to-white/[0.02]">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-amber-300" />
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                Start your 7‑day trial
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Card required. No charge for 7 days. Then <span className="font-mono text-foreground">{money(amountCents)}</span> / month · Cancel anytime.
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: '5‑Node Consensus Logic', desc: 'Multi-node verification before decisions ship.' },
                  { title: 'Auto‑Negotiator', desc: 'Drafts, counter-offers, and ready-to-send letters.' },
                  { title: 'Automated Savings Nodes', desc: 'Continuous detection of pricing drops and eligible switches based on verified spend signals.' },
                ].map((f) => (
                  <div key={f.title} className="rounded-2xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-black text-foreground dark:text-white">{f.title}</div>
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-1 shrink-0" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 dark:text-white/55">{f.desc}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-2 text-muted-foreground dark:text-white/80">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Initializing billing…
                  </div>
                </div>
              ) : authRequired ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-6 space-y-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-sm text-muted-foreground dark:text-white/80">
                    Please log in to start a trial and manage your subscription.
                  </div>
                  <Link href={getLoginHref()}>
                    <Button type="button" className="h-11 font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95">
                      Log in
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : useDemoMode ? (
                <div className="space-y-3">
                  {stripeUnavailable ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70">
                      Stripe checkout is unavailable in this environment. Using demo checkout instead.
                    </div>
                  ) : null}
                  <DemoCheckout amountCents={amountCents} onCompleteHref={onCompleteHref} />
                </div>
              ) : (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: { colorPrimary: '#34d399', borderRadius: '12px' },
                    },
                  }}
                >
                  <CheckoutForm amountCents={amountCents} onCompleteHref={onCompleteHref} />
                </Elements>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


