'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle2, Loader2, Shield, ArrowLeft } from 'lucide-react'
import { getLoginHref } from '@/lib/local-auth-bypass'

export default function VerifyEmailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'checking' | 'verified' | 'error' | 'pending'>('checking')
  const [email, setEmail] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [working, setWorking] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')


  useEffect(() => {
    // Prefill email when provided (lets users verify without being logged in yet).
    const qsEmail = String(searchParams.get('email') || '').trim()
    if (qsEmail && !email) setEmail(qsEmail)
    setStatus('pending')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const verifyFromCode = async () => {
    try {
      const e = String(email || '').trim()
      const c = String(code || '').trim().replace(/\s+/g, '')
      if (!e || !e.includes('@')) {
        setStatus('error')
        return
      }
      if (c.length < 4) {
        setStatus('error')
        return
      }
      // DEV one-time bypass: allow immediate dashboard entry even if server is slow.
      if (process.env.NODE_ENV !== 'production' && e.toLowerCase() === 'test@unity.com' && c === '123456') {
        document.cookie = 'uc_dev_bypass=1; path=/; max-age=3600; samesite=lax'
        router.replace('/dashboard')
        return
      }
      setWorking(true)
      setErrorMsg('')
      // Primary: verify using Unity Credit OTP (Resend-backed).
      const resp = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c, purpose: 'signup' }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) {
        setErrorMsg(String(json?.error || 'א טעות איז געשען. ביטע פרובירט נאכאמאל.'))
        setStatus('error')
        return
      }
      setStatus('verified')
      setTimeout(() => {
        if ((json as any)?.session) {
          router.replace('/dashboard')
          return
        }
        router.push(`/login?email=${encodeURIComponent(e)}&verified=1`)
      }, 1200)
    } catch {
      setStatus('error')
    } finally {
      setWorking(false)
    }
  }

  const checkVerificationStatus = async () => {
    try {
      setStatus('pending')
    } catch {
      setStatus('pending')
    }
  }

  const resendVerification = async () => {
    try {
      const e = String(email || '').trim()
      if (!e || !e.includes('@')) return

      setWorking(true)
      setErrorMsg('')
      // Primary: send Unity Credit OTP via Resend queue.
      const resp = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, purpose: 'signup' }),
      })
      const json = await resp.json().catch(() => ({}))
      if (resp.ok && json?.ok) {
        if (json?.debug_code && process.env.NODE_ENV !== 'production') {
          setCode(String(json.debug_code))
        }
        setStatus('pending')
        return
      }
      setErrorMsg(String(json?.error || 'עס איז נישט געלונגען צו שיקן א קאָד. ביטע פרובירט נאכאמאל.'))
      setStatus('error')
    } catch (error) {
      setErrorMsg('עס איז נישט געלונגען צו שיקן א קאָד. ביטע פרובירט נאכאמאל.')
      setStatus('error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl"></div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 h-6 w-6 rounded-full bg-gold/10 animate-pulse" />
        <div className="absolute bottom-20 right-20 h-6 w-6 rounded-full bg-gold/10 animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="backdrop-blur-xl bg-white/95 shadow-2xl border-2 border-gold/20 animate-fade-in">
          <CardHeader className="space-y-3 pb-6">
            <div className="text-center">
              <div className="text-sm font-black tracking-wide text-primary">Unity Credit</div>
              <div className="text-xs text-muted-foreground">Email verification</div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-12 h-1 bg-gradient-to-r from-transparent via-gold to-transparent"></div>
              <Mail className="text-gold" size={24} />
              <div className="w-12 h-1 bg-gradient-to-r from-transparent via-gold to-transparent"></div>
            </div>
            <CardTitle className="text-3xl font-bold text-center text-primary rtl-text">
              {status === 'verified' ? 'אימעיל וועריפיצירט!' : 'וועריפיצירט אייער אימעיל'}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground rtl-text">
              {status === 'verified'
                ? 'אייער אימעיל איז וועריפיצירט. מיר רידערעקטירן אייך צו לאגין...'
                : 'ביטע וועריפיצירט אייער אימעיל מיט א קאָד (OTP) אדער מיטן לינק וואס איר באקומט אין אימעיל.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status === 'checking' && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 text-gold animate-spin mb-4" />
                <p className="text-muted-foreground rtl-text">טשעקט וועריפיקאציע...</p>
              </div>
            )}

            {status === 'verified' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-primary rtl-text mb-2">
                  הצלחה! אייער אימעיל איז וועריפיצירט
                </p>
                <p className="text-sm text-muted-foreground rtl-text text-center">
                  מיר רידערעקטירן אייך אין א רגע...
                </p>
              </div>
            )}

            {status === 'pending' && (
              <div className="space-y-4">
                <div className="bg-gold/10 border border-gold/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="text-gold mt-1" size={20} />
                    <div className="flex-1 rtl-text">
                      <p className="font-semibold text-primary mb-2">וועריפיקאציע</p>
                      <p className="text-sm text-muted-foreground">שרייבט אריין אייער אימעיל און דעם קאָד (OTP) פון אייער אימעיל:</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-primary rtl-text">אימעיל</div>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      dir="ltr"
                      className="h-11"
                      disabled={working}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-primary rtl-text">קאָד (OTP)</div>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      dir="ltr"
                      inputMode="numeric"
                      className="h-11 tracking-widest"
                      disabled={working}
                    />
                  </div>

                  <Button onClick={verifyFromCode} className="w-full h-11 font-semibold" disabled={working}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    <span className="rtl-text">וועריפיצירן</span>
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3 rtl-text text-center">נישט באקומען דעם קאָד/לינק?</p>
                  <Button
                    onClick={resendVerification}
                    variant="outline"
                    className="w-full border-gold text-gold hover:bg-gold hover:text-primary"
                    disabled={working}
                  >
                    {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    <span className="rtl-text">שיק נאכאמאל</span>
                  </Button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800 rtl-text text-center">
                    {errorMsg || 'א טעות איז געשען. ביטע קאָנטראָלירט אייער קאָד/לינק און פרובירט נאכאמאל.'}
                  </p>
                </div>
                <Button
                  onClick={resendVerification}
                  variant="outline"
                  className="w-full border-gold text-gold hover:bg-gold hover:text-primary"
                  disabled={working}
                >
                  {working ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  <span className="rtl-text">שיק נאכאמאל</span>
                </Button>
              </div>
            )}

            <div className="pt-4 border-t">
              <Link href={getLoginHref()}>
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="rtl-text">צוריק צו לאגין</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-white/60 text-xs">
            <Shield className="text-gold" size={14} />
            <span className="rtl-text">זיכער און געשיצט</span>
          </div>
        </div>
      </div>
    </div>
  )
}


