'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseAnonClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2, ArrowLeft, Shield } from 'lucide-react'
import { getLoginHref } from '@/lib/local-auth-bypass'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [{ client: supabase, error: supabaseError }] = useState(() => getSupabaseAnonClient())
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>('')

  async function send() {
    if (sending) return
    setError('')
    const e = String(email || '').trim()
    if (!e || !e.includes('@')) {
      setError('ביטע שרייבט אריין א גילטיגע אימעיל אדרעס.')
      return
    }
    if (!supabase) {
      setError(supabaseError || 'סיסטעם קאנפיגוראציע פעלט (Supabase).')
      return
    }
    setSending(true)
    try {
      // Supabase will send the reset email using its configured email provider.
      const { error: err } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      })
      if (err) throw err
      setSent(true)
    } catch (e: any) {
      setError(String(e?.message || 'עס איז נישט געלונגען צו שיקן א ריסט־אימעיל.'))
    } finally {
      setSending(false)
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
              שרייבט אריין אייער אימעיל, און מיר וועלן שיקן א לינק צו ריסטירן אייער פּאַראָל.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 rtl-text text-right text-sm text-emerald-100">
                געשיקט. ביטע טשעקט אייער אימעיל פארן ריסט־לינק.
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
                disabled={sending || sent}
              />
            </div>

            <Button type="button" className="w-full h-11 font-semibold" onClick={send} disabled={sending || sent}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              <span className="rtl-text">{sending ? 'שיקט...' : 'שיק ריסט־לינק'}</span>
            </Button>

            <Link href={getLoginHref()}>
              <Button type="button" variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="rtl-text">צוריק צו לאגין</span>
              </Button>
            </Link>

            <div className="text-[11px] text-muted-foreground rtl-text text-right">
              נאטיץ: אין פראדאקשן דארף Supabase זיין קאנפיגורירט מיט א אימעיל־פראָוויידער כדי די ריסט־אימעיל זאל ארויסגיין.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


