'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Lock, Loader2 } from 'lucide-react'

export default function AdminLoginForm() {
  const { toast } = useToast()
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)

  async function login() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = String(json?.error || '').trim()
        throw new Error(msg || `Login failed (HTTP ${res.status})`)
      }
      window.location.reload()
    } catch (e: any) {
      toast({ title: 'Admin', description: e?.message || 'Login failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3 text-white">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-white/70" />
        <div className="text-sm font-bold text-white">Admin Login</div>
      </div>
      <Input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="Admin password"
        className="h-11 bg-slate-800/50 text-white placeholder:text-white/60 border-white/10"
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') login()
        }}
      />
      <Button type="button" onClick={login} disabled={loading} className="h-11 w-full font-semibold">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Sign in
      </Button>
    </div>
  )
}


