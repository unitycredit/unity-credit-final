'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/components/LanguageProvider'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import { setLocalSession } from '@/lib/local-session'
import { isLocalAuthBypassEnabled } from '@/lib/local-auth-bypass'
import { getSession, signIn } from 'next-auth/react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string>('')
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur for better UX
  })

  // Prefill email after OTP verification redirect (or deep links).
  // Also show a success toast if the user just verified.
  useEffect(() => {
    try {
      const e = String(searchParams.get('email') || '').trim()
      const verified = String(searchParams.get('verified') || '').trim() === '1'
      const reason = String(searchParams.get('reason') || '').trim()
      if (e) setValue('email', e as any, { shouldValidate: true })
      if (verified) {
        toast({ title: 'וועריפיצירט', description: 'אייער אימעיל איז איצט באַשטעטיגט. ביטע לאָגט איין.' })
      }
      if (reason === 'idle') {
        toast({ title: 'Security', description: 'You were logged out due to inactivity. Please log in again.' })
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setValue])

  // If already logged in, send directly to dashboard.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await getSession()
        if (cancelled) return
        if ((session as any)?.user?.id) {
          router.replace('/dashboard')
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Terminal readiness ping (server logs READY FOR FIRST USER when fully connected).
  useEffect(() => {
    // No Brain dependency: Unity Credit login is self-contained now.
  }, [])

  const emailValue = watch('email')
  const passwordValue = watch('password')

  function enterAsGuest() {
    try {
      // Temporary guest bypass: seed a lightweight local session and go straight in.
      document.cookie = 'uc_dev_bypass=1; path=/; max-age=3600; samesite=lax'
    } catch {
      // ignore
    }
    setLocalSession('guest@unitycredit.app')
    router.replace('/dashboard')
  }

  const onSubmit = async (data: LoginInput) => {
    setLoginError('')

    // LOCAL AUTH BYPASS:
    // - Requested behavior: allow the login screen at http://localhost:3002 to work without any backend/auth response.
    // - Behavior: any Login submit immediately redirects to /dashboard and seeds a lightweight local session.
    if (isLocalAuthBypassEnabled()) {
      const email = String(data.email || '').trim() || 'local@unitycredit.dev'
      try {
        document.cookie = 'uc_dev_bypass=1; path=/; max-age=3600; samesite=lax'
      } catch {
        // ignore
      }
      setLocalSession(email)
      router.replace('/dashboard')
      return
    }

    // DEV: backdoor login path for immediate dashboard access.
    // Treat password field as the "code" for this dev-only bypass.
    if (
      process.env.NODE_ENV !== 'production' &&
      String(data.email || '').trim().toLowerCase() === 'test@unity.com' &&
      String(data.password || '').trim() === '123456'
    ) {
      // One-time per browser (cookie). If already used, fail closed.
      if (typeof document !== 'undefined' && document.cookie.includes('uc_backdoor_used=1')) {
        toast({ title: 'Backdoor already used', description: 'This test bypass is one-time only.', variant: 'destructive' })
        // eslint-disable-next-line no-console
        console.error('[LOGIN] DEV BACKDOOR blocked (already used)')
        return
      }
      document.cookie = 'uc_dev_bypass=1; path=/; max-age=3600; samesite=lax'
      document.cookie = 'uc_backdoor_used=1; path=/; max-age=2592000; samesite=lax'
      setLocalSession('test@unity.com')
      router.replace('/dashboard')
      return
    }

    let result: any
    try {
      result = await signIn('credentials', {
        redirect: false,
        email: String(data.email || '').trim(),
        password: String(data.password || ''),
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[LOGIN] Network/Server error', e?.message || e)
      toast({ title: 'אַרײַנלאָגין איז נישט מצליח', description: 'Network Error', variant: 'destructive' })
      return
    }

    if (!result || result.error) {
      const rawErr = String(result?.error || '')
      let errorMessage = 'אומגילטיגע אימעיל אדער פּאַראָל. ביטע פרובירט נאכאמאל.'

      if (rawErr.includes('EMAIL_NOT_VERIFIED')) {
        errorMessage =
          'אייער אימעיל איז נאך נישט באַשטעטיגט. ביטע נעמט דעם קאָד (OTP) פון אייער אימעיל און וועריפיצירט.'
        // Best-effort: trigger OTP so the user actually receives a 6-digit code.
        try {
          await fetch('/api/auth/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: String(data.email || '').trim(), purpose: 'signup' }),
          })
        } catch {
          // ignore
        }
        router.push(`/verify-email?email=${encodeURIComponent(String(data.email || '').trim())}`)
        setLoginError('')
      } else {
        setLoginError(errorMessage)
      }

      toast({
        title: 'אַרײַנלאָגין איז נישט מצליח',
        description: errorMessage,
        variant: 'destructive',
      })
      return
    }

    toast({
      title: 'געטאָן',
      description: 'איר זענט אַרײַנגעלאָגט.',
    })
    router.push('/dashboard')
    router.refresh()
    setLocalSession(String(data.email || '').trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <UnityCreditBrandStack
              size="md"
              label="UnityCredit"
              className="text-white"
              textClassName="text-white"
              aria-label="UnityCredit"
            />
          </div>
          <p className="text-gold text-xl font-semibold mb-1 text-center">Secure sign-in</p>
          <p className="text-white/80 text-sm text-center">Enterprise · Private · Secure</p>
        </div>

        <Card className="backdrop-blur-xl bg-card shadow-2xl border-2 border-gold/20 animate-fade-in">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-3xl font-bold text-center text-primary rtl-text">
              {t('login.title')}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground rtl-text">
              {t('login.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loginError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-destructive mt-0.5 flex-shrink-0" size={20} />
                <p className="text-sm text-destructive rtl-text flex-1">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Mail className="text-gold" size={16} />
                  {t('login.email')} *
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('login.email.placeholder')}
                    dir="rtl"
                    {...register('email')}
                    className={`h-12 border-2 transition-all pr-10 bg-slate-800 text-white placeholder:text-white/60 ${
                      errors.email 
                        ? 'border-destructive focus:border-destructive' 
                        : emailValue && !errors.email
                        ? 'border-green-500 focus:border-green-500'
                        : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                    }`}
                  />
                  {emailValue && !errors.email && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    </div>
                  )}
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Lock className="text-gold" size={16} />
                  {t('login.password')} *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.password.placeholder')}
                    dir="rtl"
                    {...register('password')}
                    className={`h-12 border-2 transition-all pr-10 bg-slate-800 text-white placeholder:text-white/60 ${
                      errors.password 
                        ? 'border-destructive focus:border-destructive' 
                        : passwordValue && !errors.password
                        ? 'border-green-500 focus:border-green-500'
                        : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gold transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.password.message}
                  </p>
                )}
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-gold hover:text-gold-dark hover:underline rtl-text"
                  >
                    פארגעסן פאסווארט?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-primary font-bold text-lg shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="rtl-text">{t('login.submitting')}</span>
                  </>
                ) : (
                  <span className="rtl-text">{t('login.submit')}</span>
                )}
              </Button>

              <div className="pt-3 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11 font-bold text-white/90 hover:text-white hover:bg-white/10"
                  onClick={enterAsGuest}
                >
                  Enter as Guest (Skip Login)
                </Button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground rtl-text">או</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground rtl-text">
              {t('login.noAccount')}{' '}
              <Link href="/signup" className="text-gold font-semibold hover:text-gold-dark hover:underline transition-colors">
                {t('login.signup')}
              </Link>
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
