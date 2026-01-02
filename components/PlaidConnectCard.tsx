'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Link2, Lock, ShieldCheck, Loader2 } from 'lucide-react'
import { createPlaidLinkTokenAction } from '@/lib/actions/plaid'

export default function PlaidConnectCard() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState<'disconnected' | 'ready' | 'connected'>('disconnected')
  const [message, setMessage] = useState<string | null>(null)

  async function ensureTokenAndOpen() {
    if (connecting) return
    setConnecting(true)
    setMessage(null)
    try {
      if (!linkToken) {
        const result = await createPlaidLinkTokenAction()
        if (!('link_token' in result) || !result.link_token) {
          throw new Error(('error' in result && result.error) || 'Plaid is not configured.')
        }
        setLinkToken(result.link_token)
        setStatus('ready')
        setPendingOpen(true)
      } else {
        setPendingOpen(true)
      }
    } catch (e: any) {
      setMessage(e?.message || 'Failed to initialize Plaid.')
    } finally {
      setConnecting(false)
    }
  }

  const config = useMemo(() => {
    return {
      token: linkToken,
      onSuccess: async (public_token: string) => {
        try {
          setMessage(null)
          const res = await fetch('/api/bank/plaid/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_token }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(String(json?.error || 'Failed to connect bank'))
          setStatus('connected')
          setMessage('Bank connected. Transactions will refresh shortly.')
        } catch (e: any) {
          setMessage(e?.message || 'Failed to finalize bank connection')
        }
      },
      onExit: () => {
        // user closed without connecting
      },
    }
  }, [linkToken])

  const { open, ready } = usePlaidLink(config as any)

  useEffect(() => {
    if (!pendingOpen) return
    if (linkToken && ready) {
      open()
      setPendingOpen(false)
    }
  }, [pendingOpen, linkToken, ready, open])

  return (
    <Card className="border-0 shadow-2xl overflow-hidden bg-card text-card-foreground dark:bg-gradient-to-br dark:from-white/5 dark:to-white/[0.02]">
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400" />
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-300" />
          Bank connection (Plaid)
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          Secure <span className="font-semibold text-foreground">read-only</span> access to transactions for savings analysis.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-black text-foreground">Status</div>
              <div className="text-sm text-muted-foreground mt-1">
                {status === 'connected' ? 'Connected' : status === 'ready' ? 'Ready to connect' : 'Not connected'}
              </div>
              {message ? <div className="text-xs text-muted-foreground mt-2">{message}</div> : null}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-amber-300" />
              Encrypted tokens · no passwords stored
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-300 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              Plaid Link runs in a secure iframe flow. You can disconnect at any time from your bank, and manage access in settings.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="button"
            onClick={ensureTokenAndOpen}
            disabled={connecting}
            variant="primaryAction"
            className="h-11 hover:opacity-95"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            {status === 'connected' ? 'Reconnect bank' : 'Connect bank'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={async () => {
              setMessage(null)
              try {
                const res = await fetch('/api/bank/mock-summary', { method: 'GET' })
                const json = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(String(json?.error || 'Demo bank failed'))
                setStatus('connected')
                setMessage('Demo bank connected (sample data).')
              } catch (e: any) {
                setMessage(e?.message || 'Demo bank failed')
              }
            }}
          >
            Demo bank
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


