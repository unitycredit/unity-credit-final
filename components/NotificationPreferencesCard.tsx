'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, CheckCircle2, Loader2 } from 'lucide-react'

type Prefs = { deals: boolean; drafts: boolean }

function pill(on: boolean) {
  return on
    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-100'
    : 'bg-muted/40 text-muted-foreground border-border dark:bg-white/5 dark:text-white/70'
}

export default function NotificationPreferencesCard() {
  const [prefs, setPrefs] = useState<Prefs>({ deals: true, drafts: true })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    // Best-effort initial load: hit notifications endpoint which also returns prefs.
    ;(async () => {
      try {
        const res = await fetch('/api/notifications/latest', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json?.prefs) setPrefs({ deals: Boolean(json.prefs.deals), drafts: Boolean(json.prefs.drafts) })
      } catch {
        // ignore
      }
    })()
  }, [])

  async function save(next: Prefs) {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/notifications/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(json?.error || 'Failed to save preferences'))
      setPrefs(next)
      setStatus('Saved')
    } catch (e: any) {
      setStatus(e?.message || 'Save failed')
    } finally {
      setSaving(false)
      window.setTimeout(() => setStatus(null), 1500)
    }
  }

  return (
    <Card className="border-0 shadow-2xl overflow-hidden bg-card text-card-foreground dark:bg-gradient-to-br dark:from-white/5 dark:to-white/[0.02]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-400 via-emerald-400 to-amber-300" />
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-300" />
          Notifications
        </CardTitle>
        <div className="text-sm text-muted-foreground">Control what appears in your in-app notification feed.</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left transition ${pill(prefs.deals)}`}
            onClick={() => save({ ...prefs, deals: !prefs.deals })}
            disabled={saving}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-black">25%+ Deal alerts</div>
              {prefs.deals ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Show/hide Deal-Hunter notifications.</div>
          </button>

          <button
            type="button"
            className={`rounded-2xl border p-4 text-left transition ${pill(prefs.drafts)}`}
            onClick={() => save({ ...prefs, drafts: !prefs.drafts })}
            disabled={saving}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-black">Ready-to-send drafts</div>
              {prefs.drafts ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Show/hide Auto‑Negotiator draft notifications.</div>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => save({ deals: true, drafts: true })}
            disabled={saving}
          >
            Reset to default
          </Button>
          <div className="text-xs text-muted-foreground">
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </span>
            ) : status ? (
              status
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


