'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2, ArrowLeft, Shield } from 'lucide-react'
import { getLoginHref } from '@/lib/local-auth-bypass'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [reset, setReset] = useState(false)
  const [error, setError] = useState<string>('')

  async function send() {
    if (sending) return
    setError('')
    const e = String(email || '').trim()
    if (!e || !e.includes('@')) {
      setError('ביטע שרייבט אריין א גילטיגע אימעיל אדרעס.')
      return
    }
    setSending(true)
    try {
      const resp = await fetch('/api/auth/password-reset/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) throw new Error(String(json?.error || 'עס איז נישט געלונגען צו שיקן א קאָד.'))
      setSent(true)
    } catch (e: any) {
      setError(String(e?.message || 'עס איז נישט געלונגען צו שיקן א ריסט־אימעיל.'))
    } finally {
      setSending(false)
    }
  }

  async function confirmReset() {
    if (resetting) return
    setError('')
    const e = String(email || '').trim()
    const c = String(code || '').trim().replace(/\s+/g, '')
    const p = String(newPassword || '').trim()
    if (!e || !e.includes('@')) {
      setError('ביטע שרייבט אריין א גילטיגע אימעיל אדרעס.')
      return
    }
    if (!/^\d{6}$/.test(c)) {
      setError('ביטע שרייבט אריין דעם 6-ציפערן קאָד פון אייער אימעיל.')
      return
    }
    if (p.length < 8) {
      setError('פאסווארט איז נישט שטארק גענוג. (מינדסטער 8 כאַראַקטערס)')
      return
    }
    setResetting(true)
    try {
      const resp = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c, password: p }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) throw new Error(String(json?.error || 'ריסט איז נישט געלונגען.'))
      setReset(true)
    } catch (e: any) {
      setError(String(e?.message || 'ריסט איז נישט געלונגען.'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-xl bg-card shadow-2xl border-2 border-gold/20">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Mail className="text-gold" size={22} />
              <Shield className="text-gold" size={18} />
            </div>
            <CardTitle className="text-2xl font-black text-center text-primary rtl-text">פארגעסן פּאַראָל</CardTitle>
            <CardDescription className="text-center text-muted-foreground rtl-text">
              שרייבט אריין אייער אימעיל, און Cognito וועט שיקן א קאָד צו ריסטירן אייער פּאַראָל.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reset ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 rtl-text text-right text-sm text-emerald-100">
                פּאַראָל ריסט איז געלונגען. איר קענט יעצט גיין צוריק צו לאגין.
              </div>
            ) : sent ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 rtl-text text-right text-sm text-emerald-100">
                קאָד געשיקט. ביטע שרייבט אריין דעם קאָד און א נייעם פּאַראָל.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 rtl-text text-right text-sm text-rose-100">{error}</div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary rtl-text text-right">אימעיל</div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="h-11 bg-slate-800/50 text-white placeholder:text-white/60 border-white/10"
                disabled={sending || resetting || reset}
              />
            </div>

            {!sent ? (
              <Button type="button" className="w-full h-11 font-semibold" onClick={send} disabled={sending || reset}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                <span className="rtl-text">{sending ? 'שיקט...' : 'שיק קאָד'}</span>
              </Button>
            ) : null}

            {sent && !reset ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-primary rtl-text text-right">קאָד</div>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  dir="ltr"
                  inputMode="numeric"
                  className="h-11 bg-slate-800/50 text-white placeholder:text-white/60 border-white/10 tracking-widest"
                  disabled={resetting || reset}
                />
                <div className="text-sm font-semibold text-primary rtl-text text-right">נייער פּאַראָל</div>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  type="password"
                  className="h-11 bg-slate-800/50 text-white placeholder:text-white/60 border-white/10"
                  disabled={resetting || reset}
                />
                <Button type="button" className="w-full h-11 font-semibold" onClick={confirmReset} disabled={resetting || reset}>
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  <span className="rtl-text">{resetting ? 'ריסטירט...' : 'ריסט פּאַראָל'}</span>
                </Button>
              </div>
            ) : null}

            <Link href={getLoginHref()}>
              <Button type="button" variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="rtl-text">צוריק צו לאגין</span>
              </Button>
            </Link>

            <div className="text-[11px] text-muted-foreground rtl-text text-right">
              נאטיץ: Cognito מוז זיין קאנפיגורירט מיט Email sender (Cognito/SES) כדי דער קאָד זאל ארויסגיין.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


