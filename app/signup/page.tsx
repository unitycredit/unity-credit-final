'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput } from '@/lib/validations'
import { signUpAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mail, Lock, User, Phone, Shield, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/components/LanguageProvider'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import { getLoginHref } from '@/lib/local-auth-bypass'

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupError, setSignupError] = useState<string>('')
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    // UX:
    // - show red borders when a user leaves a required field empty (onBlur)
    // - clear errors instantly as they type (onChange)
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  const passwordValue = watch('password')
  const confirmPasswordValue = watch('confirmPassword')
  const emailValue = watch('email')

  // Password strength checker
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '', textColor: '' }
    
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++

    const labels = ['', 'זייער שוואך', 'שוואך', 'מיטל', 'שטארק', 'זייער שטארק']
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600']
    const textColors = ['', 'text-red-600', 'text-orange-600', 'text-yellow-700', 'text-green-700', 'text-green-800']
    
    return {
      strength,
      label: labels[strength],
      color: colors[strength],
      textColor: textColors[strength],
    }
  }

  const passwordStrength = getPasswordStrength(passwordValue || '')
  const [emailOtpSending, setEmailOtpSending] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState<string>('')
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailForOtp, setEmailForOtp] = useState<string>('')
  const [emailOtpError, setEmailOtpError] = useState<string>('')

  const normEmail = (v: any) => String(v || '').trim().toLowerCase()
  const enforceOtp = process.env.NODE_ENV === 'production'

  // Reset OTP state if email changes.
  useEffect(() => {
    const e = normEmail(emailValue)
    if (!e || e !== normEmail(emailForOtp)) {
      setEmailOtpSent(false)
      setEmailOtpCode('')
      setEmailOtpVerifying(false)
      setEmailVerified(false)
      setEmailForOtp(e)
      setEmailOtpError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailValue])

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )uc_ref=([^;]*)/)
      const code = m ? decodeURIComponent(m[1]) : ''
      if (code) setValue('referralCode', code, { shouldValidate: true })
    } catch {
      // ignore
    }
  }, [setValue])

  const onSubmit = async (data: SignupInput) => {
    setSignupError('')

    // Production: require email OTP verification before creating the account.
    const e = normEmail((data as any)?.email)
    if (enforceOtp && e && e.includes('@') && !emailVerified) {
      const msg = 'ביטע דריקט "שיק קאד צו אימעיל" און וועריפיצירט דעם 6־ציפער קאָד.'
      setSignupError(msg)
      toast({ title: 'וועריפיקאציע פארלאנגט', description: msg, variant: 'destructive' })
      return
    }

    const result = await signUpAction(data)

    if (result.error) {
      // Translate common Supabase errors to Yiddish
      let errorMessage = result.error
      if (result.error.includes('User already registered')) {
        errorMessage = 'דער אימעיל איז שוין רעגיסטרירט. ביטע נוצט לאגין.'
      } else if (result.error.includes('Password')) {
        errorMessage = 'פאסווארט איז נישט שטארק גענוג. ביטע נוצט א שטארקערן פאסווארט.'
      } else if (result.error.includes('Email')) {
        errorMessage = 'אומגילטיגע אימעיל אדרעס.'
      }
      
      setSignupError(errorMessage)
      toast({
        title: 'רעגיסטראציע פארפליקט',
        description: errorMessage,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'הצלחה',
        description: (result as any)?.autoLogin ? 'קאנטע געמאכט! איר זענט שוין אריינגעלאָגט.' : 'קאנטע געמאכט! ביטע טשעקט אייער אימעיל צו וועריפיצירן.',
      })
      if ((result as any)?.autoLogin) {
        router.push('/dashboard')
        router.refresh()
      } else {
      router.push(`/verify-email?email=${encodeURIComponent(String(data.email || '').trim())}`)
      }
    }
  }

  async function sendEmailCodeNow(email: string) {
    const e = normEmail(email)
    if (!e || !e.includes('@')) return
    if (emailOtpSending) return

    setEmailOtpSending(true)
    setEmailOtpError('')
    try {
      const resp = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, purpose: 'signup' }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) {
        throw new Error(String(json?.error || 'א טעות איז פארגעקומען. פרובירט נאכאמאל.'))
      }

      setEmailOtpSent(true)
      setEmailVerified(false)
      setEmailOtpCode('')
      toast({
        title: 'קאָד געשיקט',
        description:
          json?.debug_code && process.env.NODE_ENV !== 'production'
            ? `DEV: קאָד: ${String(json.debug_code)}`
            : 'מיר האבן געשיקט א קאָד צו אייער אימעיל. ביטע שרייבט אים אריין אונטן.',
      })
    } catch (err: any) {
      setEmailOtpError(err?.message || 'קאָד איז נישט געשיקט')
      toast({
        title: 'קאָד איז נישט געשיקט',
        description: err?.message || 'א טעות איז פארגעקומען. פרובירט נאכאמאל.',
        variant: 'destructive',
      })
    } finally {
      setEmailOtpSending(false)
    }
  }

  async function verifyEmailCodeNow() {
    const e = normEmail(emailValue)
    const c = String(emailOtpCode || '').trim().replace(/\s+/g, '')
    if (!e || !e.includes('@')) return
    if (c.length !== 6) {
      setEmailOtpError('ביטע שרייבט אריין א 6־ציפער קאָד.')
      return
    }
    if (emailOtpVerifying) return
    setEmailOtpVerifying(true)
    setEmailOtpError('')
    try {
      const resp = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: c, purpose: 'signup' }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) {
        throw new Error(String(json?.error || 'אומגילטיגער קאָד אדער דער קאָד איז אויסגעגאנגען.'))
      }

      setEmailVerified(true)
      toast({
        title: 'אימעיל וועריפיצירט',
        description: 'אייער אימעיל איז הצלחה וועריפיצירט.',
      })
    } catch (err: any) {
      setEmailVerified(false)
      setEmailOtpError(err?.message || 'אומגילטיגער קאָד אדער דער קאָד איז אויסגעגאנגען.')
      toast({
        title: 'וועריפיקאציע נישט געלונגען',
        description: err?.message || 'אומגילטיגער קאָד אדער דער קאָד איז אויסגעגאנגען.',
        variant: 'destructive',
      })
    } finally {
      setEmailOtpVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <UnityCreditBrandStack
              size="lg"
              label="UnityCredit"
              className="text-white"
              textClassName="text-white"
              aria-label="UnityCredit"
            />
          </div>
          <p className="text-gold text-sm font-semibold">Email verification required</p>
        </div>

        <Card className="backdrop-blur-xl bg-white/95 shadow-2xl border-2 border-gold/20 animate-fade-in">
          <CardHeader className="space-y-3 pb-6">
            <CardTitle className="text-3xl font-bold text-center text-primary rtl-text">
              {t('signup.title')}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground rtl-text">
              {t('signup.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {signupError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-destructive mt-0.5 flex-shrink-0" size={20} />
                <p className="text-sm text-destructive rtl-text flex-1">{signupError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-primary font-semibold rtl-text flex items-center gap-2">
                    <User className="text-gold" size={16} />
                    {t('signup.firstName')} *
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder={t('signup.firstName')}
                    dir="rtl"
                    {...register('firstName')}
                    className={`h-12 border-2 transition-all ${
                      errors.firstName 
                        ? 'border-destructive focus:border-destructive' 
                        : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-primary font-semibold rtl-text flex items-center gap-2">
                    <User className="text-gold" size={16} />
                    {t('signup.lastName')} *
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder={t('signup.lastName')}
                    dir="rtl"
                    {...register('lastName')}
                    className={`h-12 border-2 transition-all ${
                      errors.lastName 
                        ? 'border-destructive focus:border-destructive' 
                        : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Mail className="text-gold" size={16} />
                  אימעיל *
                </Label>
                <div className="flex gap-2 items-stretch">
                  <div className="relative flex-1">
                    <Input
                      id="email"
                      type="email"
                      placeholder="שרייב אייער אימעיל"
                      dir="rtl"
                      {...register('email')}
                      className={`h-12 border-2 transition-all pr-10 ${
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
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 border-gold text-gold hover:bg-gold hover:text-primary"
                    onClick={() => sendEmailCodeNow(String(emailValue || ''))}
                    disabled={emailOtpSending || !emailValue || !!errors.email}
                  >
                    {emailOtpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    <span className="rtl-text">שיק קאד צו אימעיל</span>
                  </Button>
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.email.message}
                  </p>
                )}

                {/* Code input (ONLY after clicking "send code") */}
                {emailOtpSent && (
                  <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 space-y-3">
                    <div className="rtl-text text-sm font-semibold text-primary">קאָד פון אימעיל</div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                      <Input
                        value={emailOtpCode}
                        onChange={(e) => setEmailOtpCode(String(e.target.value || '').replace(/\\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className={`h-11 tracking-widest border-2 ${emailOtpError ? 'border-destructive' : 'border-gray-200'}`}
                        disabled={emailOtpVerifying}
                      />
                      <Button
                        type="button"
                        onClick={verifyEmailCodeNow}
                        className="h-11"
                        disabled={emailOtpVerifying || emailOtpCode.length !== 6}
                      >
                        {emailOtpVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        <span className="rtl-text">וועריפיצירן</span>
                      </Button>
                    </div>
                    {emailVerified ? (
                      <div className="text-xs text-emerald-700 rtl-text flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-700" size={14} />
                        אימעיל איז וועריפיצירט
                      </div>
                    ) : emailOtpError ? (
                      <div className="text-xs text-destructive rtl-text flex items-center gap-2">
                        <AlertCircle className="text-destructive" size={14} />
                        {emailOtpError}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground rtl-text">שרייבט אריין דעם 6־ציפער קאָד וואס איר האט באקומען אין אימעיל.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Phone className="text-gold" size={16} />
                  {t('signup.phone')} *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t('signup.phone')}
                  dir="rtl"
                  {...register('phone')}
                  className={`h-12 border-2 transition-all ${
                    errors.phone 
                      ? 'border-destructive focus:border-destructive' 
                      : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                  }`}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {/* Referral Code (optional) */}
              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <CheckCircle2 className="text-gold" size={16} />
                  Referral Code (optional)
                </Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="למשל: A1B2C3D4E5"
                  dir="ltr"
                  autoComplete="off"
                  {...register('referralCode')}
                  className={`h-12 border-2 transition-all ${
                    (errors as any).referralCode
                      ? 'border-destructive focus:border-destructive'
                      : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                  }`}
                />
                {(errors as any).referralCode && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {(errors as any).referralCode.message}
                  </p>
                )}
                <div className="text-xs text-muted-foreground rtl-text text-right">
                  אויב דו ביסט געקומען פון א חבר׳ס לינק, דער קאָד ווערט אוטאמאטיש אנגעפילט.
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Lock className="text-gold" size={16} />
                  {t('signup.password')} *
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('signup.password')}
                    dir="rtl"
                    {...register('password')}
                    className={`h-12 border-2 transition-all pr-10 ${
                      errors.password 
                        ? 'border-destructive focus:border-destructive' 
                        : passwordValue && !errors.password && passwordStrength.strength >= 4
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
                
                {/* Password Strength Indicator */}
                {passwordValue && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            level <= passwordStrength.strength
                              ? passwordStrength.color
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    {passwordStrength.label && (
                      <p className={`text-xs rtl-text ${passwordStrength.textColor || ''}`}>
                        {passwordStrength.label}
                      </p>
                    )}
                  </div>
                )}

                {errors.password && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {errors.password.message}
                  </p>
                )}

                <div className="bg-gold/10 border border-gold/20 rounded-lg p-3 mt-2">
                  <p className="text-xs text-primary font-medium mb-2 rtl-text">פאסווארט רעקווירעמענטס:</p>
                  <ul className="space-y-1 text-xs text-muted-foreground rtl-text">
                    <li className={`flex items-center gap-2 ${passwordValue && passwordValue.length >= 8 ? 'text-emerald-600 font-semibold' : ''}`}>
                      <CheckCircle2 className={`${passwordValue && passwordValue.length >= 8 ? 'text-emerald-600' : 'text-gold'}`} size={12} />
                      מינימום 8 אותיות
                    </li>
                    <li className={`flex items-center gap-2 ${passwordValue && /[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue) ? 'text-emerald-600 font-semibold' : ''}`}>
                      <CheckCircle2
                        className={`${passwordValue && /[A-Z]/.test(passwordValue) && /[a-z]/.test(passwordValue) ? 'text-emerald-600' : 'text-gold'}`}
                        size={12}
                      />
                      גרויס-און-קליין אותיות
                    </li>
                    <li className={`flex items-center gap-2 ${passwordValue && /[0-9]/.test(passwordValue) ? 'text-emerald-600 font-semibold' : ''}`}>
                      <CheckCircle2 className={`${passwordValue && /[0-9]/.test(passwordValue) ? 'text-emerald-600' : 'text-gold'}`} size={12} />
                      נומערן
                    </li>
                    <li className={`flex items-center gap-2 ${passwordValue && /[^A-Za-z0-9]/.test(passwordValue) ? 'text-emerald-600 font-semibold' : ''}`}>
                      <CheckCircle2 className={`${passwordValue && /[^A-Za-z0-9]/.test(passwordValue) ? 'text-emerald-600' : 'text-gold'}`} size={12} />
                      ספעציעלע צייכען
                    </li>
                    <li className={`flex items-center gap-2 ${passwordValue && !/\s/.test(passwordValue) ? 'text-emerald-600 font-semibold' : ''}`}>
                      <CheckCircle2 className={`${passwordValue && !/\s/.test(passwordValue) ? 'text-emerald-600' : 'text-gold'}`} size={12} />
                      קיין שפייסן
                    </li>
                  </ul>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-primary font-semibold rtl-text flex items-center gap-2">
                  <Lock className="text-gold" size={16} />
                  {t('signup.confirmPassword')} *
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={t('signup.confirmPassword')}
                    dir="rtl"
                    {...register('confirmPassword')}
                    className={`h-12 border-2 transition-all pr-10 ${
                      (errors as any).confirmPassword
                        ? 'border-destructive focus:border-destructive'
                        : confirmPasswordValue && confirmPasswordValue === passwordValue && !errors.password
                        ? 'border-green-500 focus:border-green-500'
                        : 'border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gold transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {(errors as any).confirmPassword && (
                  <p className="text-sm text-destructive rtl-text flex items-center gap-1">
                    <AlertCircle size={14} />
                    {(errors as any).confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-gold to-gold-dark text-primary font-bold text-lg shadow-lg shadow-gold/30 hover:shadow-xl hover:shadow-gold/40 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                disabled={isSubmitting || (enforceOtp && !emailVerified)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="rtl-text">מאכט קאנטע...</span>
                  </>
                ) : (
                  <span className="rtl-text">מאכן קאנטע</span>
                )}
              </Button>
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
              שוין קיין קאנטע?{' '}
              <Link href={getLoginHref()} className="text-gold font-semibold hover:text-gold-dark hover:underline transition-colors">
                לאגין
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Security Badge */}
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
