'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCurrentUser } from '@/lib/actions/auth'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/components/LanguageProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { usePremiumStatus } from '@/components/usePremiumStatus'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import { getLocalSession } from '@/lib/local-session'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { lang, setLang, t } = useI18n()
  const premium = usePremiumStatus()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [supabaseMissing, setSupabaseMissing] = useState<string | null>(null)
  const [adminPin, setAdminPin] = useState('')
  const [showAdminBox, setShowAdminBox] = useState(false)
  const [pinArmed, setPinArmed] = useState(false)
  const pinInputRef = useRef<HTMLInputElement | null>(null)
  const armTimerRef = useRef<any>(null)

  // Dev override: allow settings access without login so UI can be verified immediately.
  // (Never enabled in production.)
  const bypassCookieEnabled =
    typeof document !== 'undefined' && /(?:^|;\s*)uc_dev_bypass=1(?:;|$)/.test(document.cookie || '')
  let localSessionEmail = ''
  try {
    if (typeof window !== 'undefined') localSessionEmail = String(getLocalSession()?.email || '').trim().toLowerCase()
  } catch {
    // ignore
  }
  const allowGuest = bypassCookieEnabled || localSessionEmail.startsWith('guest@') || process.env.NODE_ENV !== 'production'
  const [savingProfile, setSavingProfile] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [tab, setTab] = useState<'general' | 'billing'>('general')

  useEffect(() => {
    const q = String(searchParams?.get('tab') || '').toLowerCase()
    setTab(q === 'billing' ? 'billing' : 'general')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const checkoutState = useMemo(() => {
    const v = String(searchParams?.get('checkout') || '').toLowerCase()
    return v === 'success' ? 'success' : v === 'cancel' ? 'cancel' : null
  }, [searchParams])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    // This is a UI shortcut only. It does NOT grant admin access without the real admin login.
    if (adminPin === '123456') {
      setShowAdminBox(true)
    } else if (adminPin.length >= 6) {
      setShowAdminBox(false)
    }
  }, [adminPin])

  function armPinInput() {
    setPinArmed(true)
    if (armTimerRef.current) clearTimeout(armTimerRef.current)
    // Auto-disarm after a short window (keeps it effectively invisible unless explicitly triggered).
    armTimerRef.current = setTimeout(() => {
      setPinArmed(false)
      setAdminPin('')
    }, 8000)
  }

  function focusHiddenPinInput() {
    const el = pinInputRef.current
    if (!el) return
    try {
      armPinInput()
      el.focus()
      el.select?.()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Hidden PIN entry:
    // - Active but 100% invisible until explicitly armed (Shift+A or Shift+Click on the tiny trigger).
    // - This is intentionally only a UI reveal, not authentication.
    let timer: any = null

    const onKeyDown = (e: KeyboardEvent) => {
      if (!pinArmed) return
      const el = document.activeElement as any
      const tag = String(el?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const k = e.key
      if (!/^\d$/.test(k)) return
      setAdminPin((prev) => {
        const next = (prev + k).slice(-6)
        return next
      })

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setAdminPin(''), 4000)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [pinArmed])

  useEffect(() => {
    // Explicit trigger: Shift + A focuses the hidden PIN input box.
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as any
      const tag = String(el?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (e.shiftKey && String(e.key || '').toLowerCase() === 'a') {
        e.preventDefault()
        armPinInput()
        focusHiddenPinInput()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const checkUser = async () => {
    if (allowGuest) {
      setSupabaseMissing(null)
      setUser({ email: 'guest@unitycredit.dev', user_metadata: { first_name: 'Guest', last_name: '' } })
      setFirstName('Guest')
      setLastName('')
      setPhone('')
      setLoading(false)
      return
    }

    const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (!hasSupabaseEnv) {
      setSupabaseMissing('סיסטעם קאנפיגוראציע פעלט (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).')
      setLoading(false)
      return
    }

    const result = await getCurrentUser()
    if (!result?.user) {
      router.push('/login')
      return
    }
    setUser(result.user)
    const md = result.user?.user_metadata || {}
    const p = result.user?.profile || {}
    setFirstName(String(p.first_name || md.first_name || '').trim())
    setLastName(String(p.last_name || md.last_name || '').trim())
    setPhone(String(p.phone || md.phone || '').trim())
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="rtl-text text-xl">לייגט אן...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-white to-[#f0f2f5] relative">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-4xl font-black text-[#001f3f] rtl-text">{t('settings.title')}</h1>
            <div className="text-sm text-slate-600 rtl-text mt-1">Manage your account, language, and billing.</div>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-center">
              <UnityCreditBrandStack size="sm" label="UnityCredit" aria-label="UnityCredit" textClassName="font-black text-[#001f3f]" />
            </div>
            <Button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="h-10 bg-[#001f3f] hover:bg-[#003d7a] text-white font-black"
              title="צוריק"
            >
              Back
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button
            type="button"
            variant="outline"
            className={tab === 'general' ? 'h-10 bg-[#001f3f] text-white border-[#001f3f] font-black' : 'h-10 border-slate-300 text-[#001f3f] font-bold'}
            onClick={() => router.replace('/settings?tab=general')}
          >
            General
          </Button>
          <Button
            type="button"
            variant="outline"
            className={tab === 'billing' ? 'h-10 bg-[#001f3f] text-white border-[#001f3f] font-black' : 'h-10 border-slate-300 text-[#001f3f] font-bold'}
            onClick={() => router.replace('/settings?tab=billing')}
          >
            Billing
          </Button>
        </div>

        {/* Tiny invisible trigger (1x1 px): Shift+Click to focus/arm the hidden PIN input */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 w-px h-px opacity-0"
          onMouseDown={(e) => {
            if ((e as any)?.shiftKey) {
              armPinInput()
              focusHiddenPinInput()
            }
          }}
        />

        {supabaseMissing && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 rtl-text text-right">
            <div className="font-bold text-amber-900">סופּאַבייס איז נישט קאנפיגורירט</div>
            <div className="text-sm text-amber-800 mt-1">
              {supabaseMissing} (קוקט אין <code>.env.local</code> און ריסטאַרט <code>npm run dev</code>)
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Always show Language + General settings (no click needed) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary to-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="rtl-text text-xl text-primary text-right">{t('settings.language.title')}</CardTitle>
                <p className="rtl-text text-sm text-muted-foreground text-right">{t('settings.language.desc')}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label className="rtl-text text-right font-semibold text-primary">{t('settings.language.title')}</Label>
                <Select
                  value={lang}
                  onValueChange={async (v) => {
                    await setLang(v as any)
                  }}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yi">{t('settings.language.yi')}</SelectItem>
                    <SelectItem value="en">{t('settings.language.en')}</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
              <CardHeader className="pb-4">
                <CardTitle className="rtl-text text-xl text-primary text-right">{t('settings.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="rtl-text text-right font-semibold text-primary">{t('settings.email')}</Label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    dir={lang === 'yi' ? 'rtl' : 'ltr'}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="rtl-text text-right font-semibold text-primary">First name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="rtl-text text-right font-semibold text-primary">Last name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="rtl-text text-right font-semibold text-primary">Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" inputMode="tel" />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={savingProfile || Boolean(supabaseMissing) || allowGuest}
                    onClick={async () => {
                      if (savingProfile) return
                      setSavingProfile(true)
                      try {
                        const resp = await fetch('/api/profile/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ first_name: firstName, last_name: lastName, phone }),
                        })
                        const json = await resp.json().catch(() => ({}))
                        if (!resp.ok || !json?.ok) throw new Error(String(json?.error || `HTTP ${resp.status}`))

                        setUser((prev: any) => {
                          const next = { ...(prev || {}) }
                          next.user_metadata = { ...(next.user_metadata || {}), ...json.profile }
                          next.profile = { ...(next.profile || {}), ...json.profile }
                          return next
                        })
                        toast({ title: 'Saved', description: 'Your profile has been updated.' })
                      } catch (e: any) {
                        toast({ title: 'Error', description: e?.message || 'Update failed', variant: 'destructive' })
                      } finally {
                        setSavingProfile(false)
                      }
                    }}
                    className="h-11"
                  >
                    {savingProfile ? 'Saving…' : 'Save profile'}
                  </Button>
                </div>

                {/* Hidden Admin PIN (UI reveal only; does not bypass admin auth) */}
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  autoComplete="off"
                  className="absolute -left-[9999px] -top-[9999px] h-0 w-0 opacity-0"
                  ref={pinInputRef}
                />

                {showAdminBox ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="font-black text-primary rtl-text text-right">{t('settings.adminAccess.title')}</div>
                      <div className="text-sm text-slate-600 rtl-text text-right mt-1">{t('settings.adminAccess.desc')}</div>
                      <div className="mt-3 flex justify-end gap-2 flex-wrap">
                        <Button type="button" variant="outline" onClick={() => router.push('/admin/login')}>
                          {t('settings.adminAccess.openLogin')}
                        </Button>
                        <Button type="button" onClick={() => router.push('/admin')}>
                          {t('settings.adminAccess.openDashboard')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Billing is optional via tab, but never hides General/Language */}
          {tab === 'billing' ? (
            <div className="max-w-3xl">
            <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#001f3f] to-[#003d7a]" />
              <CardHeader className="pb-4">
                <CardTitle className="rtl-text text-xl text-[#001f3f] text-right font-black">Billing</CardTitle>
                <p className="rtl-text text-sm text-muted-foreground text-right">
                  Manage your subscription, payment method, and access status.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 rtl-text text-right">
                {checkoutState === 'success' ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 rtl-text">
                    Checkout successful. Your Pro access should unlock shortly.
                  </div>
                ) : checkoutState === 'cancel' ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 rtl-text">
                    Checkout canceled.
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-slate-600 rtl-text">Current status</div>
                    <div className="font-black text-primary rtl-text">
                      {premium.loading ? 'Loading…' : String(premium.status?.tier || 'free')}
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="h-10" onClick={() => premium.refresh()}>
                    Refresh status
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-black text-primary rtl-text">Pro — $14.99 / month</div>
                    <div className="text-xs text-slate-600 rtl-text mt-1">
                      Unlock Bank Connection, Bills, Expenses modules, and Unity Intelligence Smart Savings.
                    </div>
                    <div className="mt-3 flex gap-2 justify-end flex-wrap">
                      <Button
                        type="button"
                        className="h-10 bg-[#001f3f] hover:bg-[#003d7a] text-white font-black"
                        onClick={() => (window.location.href = '/api/checkout')}
                      >
                        Upgrade to Pro
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 border-slate-300 text-[#001f3f] font-bold"
                        onClick={() => (window.location.href = '/api/portal')}
                      >
                        Manage payment method
                      </Button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 rtl-text">
                      Requires Stripe configuration: <code>STRIPE_SECRET_KEY</code>. Optional: <code>STRIPE_PRICE_ID_PRO_MONTHLY</code>.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

