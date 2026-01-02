'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Building2, Link2, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { usePlaidLink } from 'react-plaid-link'
import { createPlaidLinkTokenAction } from '@/lib/actions/plaid'

type Props = {
  onSummary?: (summary: {
    monthly_income: number | null
    monthly_expenses: number
    total_balance?: number
    accounts_count?: number
    transaction_count?: number
    top_spend_categories?: Array<{ name: string; amount: number }>
    insurance_estimate?: number
    last_updated?: string
    heimishe_budget?: Array<{ key: string; yi: string; monthly_amount: number }>
    transactions_preview?: Array<{ date: string; merchant: string; name: string; amount: number; category: string }>
  }) => void
  /** Dashboard-level overlay while the bank connection is being finalized server-side. */
  onSyncingChange?: (syncing: boolean) => void
  /** Called after a successful connection so the parent can refresh `/api/bank/summary` for "real" transactions. */
  onConnected?: () => void
}

export default function BankConnectionPlaceholder({ onSummary, onSyncingChange, onConnected }: Props) {
  const { toast } = useToast()
  const [connecting, setConnecting] = useState(false)
  const [mocking, setMocking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'disconnected' | 'ready' | 'connected' | 'reconnect_required'>('disconnected')
  const [pendingOpen, setPendingOpen] = useState(false)
  const bankActive = status === 'connected'
  const reconnectRequired = status === 'reconnect_required'

  // Read last sync + detect reconnect required (best-effort; does not block UI).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/bank/sync-status', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        const s = (json as any)?.sync_state
        if (s?.status === 'reconnect_required') {
          setStatus('reconnect_required')
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConnect = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      if (!linkToken) {
        // Step 1: request a link_token (Server Action)
        const result = await createPlaidLinkTokenAction()
        if (!('link_token' in result) || !result.link_token) {
          throw new Error(('error' in result && result.error) || 'קאנעקשאן איז נישט גרייט.')
        }

        setLinkToken(result.link_token)
        setStatus('ready')
        setPendingOpen(true) // open once Plaid Link becomes ready
        toast({
          title: 'גרייט צו פארבינדן',
          description: 'די זיכערע פארבינדונג־פענסטער וועט זיך יעצט עפענען.',
        })
      } else {
        // If token exists, just trigger open (or wait for Plaid Link to be ready).
        setPendingOpen(true)
      }
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען צו פארבינדן. ביטע פרובירט נאכאמאל.',
        variant: 'destructive',
      })
    } finally {
      setConnecting(false)
    }
  }

  const config = useMemo(() => {
    return {
      token: linkToken,
      onSuccess: async (public_token: string) => {
        try {
          setSyncing(true)
          // Step 2: exchange public_token server-side (with retry; never hang).
          const maxAttempts = 3
          let lastErr: string | null = null
          let json: any = null
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              const res = await fetch('/api/bank/plaid/exchange-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_token }),
              })
              json = await res.json().catch(() => ({}))
              if (res.ok) break
              const msg = String(json?.error || 'Bank connection failed.').trim()
              lastErr = msg
              if (res.status === 403 && (json as any)?.reconnect_required) {
                setStatus('reconnect_required')
                throw new Error('Re-connect Required')
              }
              // Retry on transient upstream/service errors
              if (res.status === 502 || res.status === 503 || res.status === 504) {
                if (attempt < maxAttempts) {
                  await new Promise((r) => setTimeout(r, attempt === 1 ? 350 : attempt === 2 ? 700 : 1200))
                  continue
                }
              }
              throw new Error(msg)
            } catch (e: any) {
              lastErr = String(e?.message || 'Bank connection failed.').trim()
              if (attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, attempt === 1 ? 350 : attempt === 2 ? 700 : 1200))
                continue
              }
              throw new Error(lastErr)
            }
          }
          if (!json) throw new Error(lastErr || 'עס איז נישט געלונגען צו פארבינדן.')

          if (json?.summary && typeof json.summary.monthly_expenses === 'number') {
            onSummary?.({
              monthly_income: json.summary.monthly_income ?? null,
              monthly_expenses: json.summary.monthly_expenses,
              total_balance: typeof json.summary.total_balance === 'number' ? json.summary.total_balance : undefined,
              accounts_count: typeof json.summary.accounts_count === 'number' ? json.summary.accounts_count : undefined,
              transaction_count: json.summary.transaction_count,
              top_spend_categories: json.summary.top_spend_categories,
              insurance_estimate: json.summary.insurance_estimate,
              last_updated: json.summary.last_updated,
              heimishe_budget: Array.isArray(json.heimishe_budget) ? json.heimishe_budget : undefined,
              transactions_preview: Array.isArray(json.transactions_preview) ? json.transactions_preview : undefined,
            })
          }

          setStatus('connected')
          toast({
            title: 'פארבונדן',
            description: 'דער באנק איז פארבונדן. די טשאַרטן ווערן יעצט דערהיינטיקט לויט טראַנזאַקציעס.',
          })
          // Refresh "All Bank Expenses" from DB-backed `/api/bank/summary` after connection is finalized.
          await Promise.resolve(onConnected?.()).catch(() => null)
        } catch (e: any) {
          if (String(e?.message || '').toLowerCase().includes('re-connect')) {
            setStatus('reconnect_required')
          }
          toast({
            title: 'טעות',
            description: e?.message || 'עס איז נישט געלונגען צו פארענדיקן די פארבינדונג.',
            variant: 'destructive',
          })
        } finally {
          setSyncing(false)
        }
      },
      onExit: () => {
        // user closed without connecting
      },
    }
  }, [linkToken, onSummary, toast, onConnected])

  const { open, ready } = usePlaidLink(config as any)

  // Open automatically after we obtain a link_token (one-click UX).
  useEffect(() => {
    if (!pendingOpen) return
    if (linkToken && ready) {
      open()
      setPendingOpen(false)
    }
  }, [pendingOpen, linkToken, ready, open])

  // Inform parent (dashboard) so it can show a global overlay.
  useEffect(() => {
    onSyncingChange?.(syncing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, onSyncingChange])

  const handleMockConnect = async () => {
    if (mocking || connecting) return
    setMocking(true)
    try {
      const res = await fetch('/api/bank/mock-summary', { method: 'GET' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'דעמאָ־באַנק איז דורכגעפאלן')

      if (json?.summary && typeof json.summary.monthly_expenses === 'number') {
        onSummary?.({
          monthly_income: json.summary.monthly_income ?? null,
          monthly_expenses: json.summary.monthly_expenses,
          total_balance: typeof json.summary.total_balance === 'number' ? json.summary.total_balance : undefined,
          accounts_count: typeof json.summary.accounts_count === 'number' ? json.summary.accounts_count : undefined,
          transaction_count: json.summary.transaction_count,
          top_spend_categories: json.summary.top_spend_categories,
          insurance_estimate: json.summary.insurance_estimate,
          last_updated: json.summary.last_updated,
          heimishe_budget: Array.isArray(json.heimishe_budget) ? json.heimishe_budget : undefined,
          transactions_preview: Array.isArray(json.transactions_preview) ? json.transactions_preview : undefined,
        })
      }

      setStatus('connected')
      toast({
        title: 'דעמאָ־באַנק פארבונדן',
        description: 'געפילט מיט מוסטער־דאַטע כדי איר קענט ווייטער נוצן דעם דאַשבאָרד אָן קיין Plaid־וועריפיקאַציע.',
      })
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען צו לאָדן דעמאָ־באַנק דאַטע.',
        variant: 'destructive',
      })
    } finally {
      setMocking(false)
    }
  }

  const handleManualSync = async () => {
    if (syncing || connecting || mocking) return
    setSyncing(true)
    try {
      const res = await fetch('/api/bank/plaid/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 403 && (json as any)?.reconnect_required) {
        setStatus('reconnect_required')
        throw new Error('Re-connect Required')
      }
      if (!res.ok) throw new Error(String((json as any)?.error || 'Manual sync failed'))

      if (json?.summary && typeof json.summary.monthly_expenses === 'number') {
        onSummary?.({
          monthly_income: json.summary.monthly_income ?? null,
          monthly_expenses: json.summary.monthly_expenses,
          total_balance: typeof json.summary.total_balance === 'number' ? json.summary.total_balance : undefined,
          accounts_count: typeof json.summary.accounts_count === 'number' ? json.summary.accounts_count : undefined,
          transaction_count: json.summary.transaction_count,
          top_spend_categories: json.summary.top_spend_categories,
          insurance_estimate: json.summary.insurance_estimate,
          last_updated: json.summary.last_updated,
          transactions_preview: Array.isArray(json.transactions_preview) ? json.transactions_preview : undefined,
        })
      }

      setStatus('connected')
      toast({
        title: 'Manual Sync',
        description: 'Bank transactions were refreshed.',
      })
    } catch (e: any) {
      toast({
        title: 'טעות',
        description: e?.message || 'עס איז נישט געלונגען צו מאכן א Manual Sync.',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-[#4A4A4A]" />
      <CardHeader className="pb-4 rtl-text text-right">
        <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#4A4A4A]" />
          באנק-פארבינדונג
        </CardTitle>
        <p className="rtl-text text-base text-muted-foreground">
          א זיכערע <strong>נאָר־לייענען</strong> באנק־פארבינדונג (Plaid) כדי צו לייענען טראַנזאַקציעס און מאנאטליכע הוצאות — קיין געלט ווערט קיינמאל נישט באַוועגט.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 rtl-text text-right">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start gap-3 rtl-text">
            <div className="mt-0.5">
              <ShieldCheck className="h-5 w-5 text-[#4A4A4A]" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-primary rtl-text">זיכערהייט סטאנדארט</p>
              <p className="text-base text-muted-foreground rtl-text">
                מיר נעמען נישט קיין באנק־פּאסווערטער. די פארבינדונג גייט דורך א באשטעטיגטער פּראַוויידער, און מיר באקומען נאר ענקריפּטירטע טאָקענס.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="rtl-text">
              <p className="font-semibold text-primary rtl-text">סטאטוס</p>
              <p className="text-base text-muted-foreground rtl-text">
                {status === 'reconnect_required'
                  ? 'Re-connect Required'
                  : status === 'connected'
                  ? 'פארבונדן'
                  : status === 'ready'
                  ? 'גרייט צו פארבינדן'
                  : 'נישט פארבונדן'}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 rtl-text">
              <Lock className="h-3.5 w-3.5 text-gold" />
              ענקריפּטירטע טאָקענס (קיינמאל נישט קלאר־טעקסט)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={handleConnect}
            disabled={connecting || mocking}
            variant="primaryAction"
            className="w-full h-12 shadow-lg hover:opacity-95"
          >
            <Link2 className="h-4 w-4 mr-2" />
            <span className="rtl-text flex items-center gap-2">
              {connecting
                ? 'פארבינדט...'
                : reconnectRequired
                ? 'Re-connect Required'
                : status === 'connected'
                ? 'פארבונדן'
                : 'פֿאַרבינדן א באַנק'}
              {bankActive ? (
                <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-black">
                  באנק אקטיוו
                </span>
              ) : null}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleManualSync}
            disabled={!bankActive || syncing || connecting || mocking}
            className="w-full h-12 font-semibold"
          >
            <span className="rtl-text flex items-center gap-2 justify-center">
              {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'סינקט...' : 'Manual Sync'}
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleMockConnect}
            disabled={mocking || connecting}
            className="w-full h-12 font-semibold"
          >
            <span className="rtl-text">{mocking ? 'לאָדנט...' : 'דעמאָ־באַנק (אָפ־ליין)'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


