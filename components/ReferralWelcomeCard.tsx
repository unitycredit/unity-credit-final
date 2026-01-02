'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { getSupabaseAnonClient } from '@/lib/supabase-browser'
import { getLoginHref } from '@/lib/local-auth-bypass'

function readCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&')}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

function isValidCode(code: string) {
  return /^[A-Za-z0-9_-]{4,32}$/.test(code)
}

export default function ReferralWelcomeCard() {
  const { toast } = useToast()
  const [applied, setApplied] = useState<string>('')
  const [input, setInput] = useState<string>('')
  const [myCode, setMyCode] = useState<string>('')
  const [loadingMyCode, setLoadingMyCode] = useState(false)

  useEffect(() => {
    // Initialize from cookie or URL query string.
    const cookieCode = readCookie('uc_ref')
    const urlCode = new URL(window.location.href).searchParams.get('ref') || ''
    const code = (cookieCode || urlCode).trim()
    if (code && isValidCode(code)) setApplied(code)
  }, [])

  async function applyCode(codeRaw: string) {
    const code = String(codeRaw || '').trim()
    if (!isValidCode(code)) {
      toast({ title: 'Referral', description: 'Invalid referral code.', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/referrals/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: 'Referral', description: json?.error || 'Failed to apply code.', variant: 'destructive' })
      return
    }
    setApplied(code)
    setInput('')
    toast({ title: 'Referral applied', description: `Code saved: ${code}` })
  }

  async function loadMyCode() {
    if (loadingMyCode) return
    setLoadingMyCode(true)
    try {
      const { client } = getSupabaseAnonClient()
      const { data } = client ? await client.auth.getUser() : ({ data: { user: null } } as any)
      if (!data?.user) {
        setMyCode('')
        return
      }

      const res = await fetch('/api/referrals/my-code')
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.code) setMyCode(String(json.code))
    } finally {
      setLoadingMyCode(false)
    }
  }

  useEffect(() => {
    loadMyCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inviteLink = useMemo(() => {
    if (!myCode) return ''
    if (typeof window === 'undefined') return ''
    const u = new URL(window.location.origin)
    u.searchParams.set('ref', myCode)
    return u.toString()
  }, [myCode])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copied', description: 'Copied to clipboard.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' })
    }
  }

  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-bold text-white/80 rtl-text text-right">Referral System</div>
          <div className="mt-1 text-xl font-black text-white rtl-text text-right">ברענג א חבר — און וואקסן צו 50,000</div>
          <div className="mt-2 text-sm text-white/80 rtl-text text-right leading-6">
            האסט א קאָד? לייג עס אריין. ביסט שוין איינגעשריבן? נעם דיינע אייגענע לינק און טייל עס.
          </div>
        </div>
        {applied ? (
          <div className="text-xs font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/20 rounded-full px-3 py-2">
            Applied: <span className="font-mono">{applied}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/15 bg-black/10 p-4">
          <div className="text-sm font-bold text-white/90 rtl-text text-right">איינגעבן א Referral Code</div>
          <div className="mt-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="למשל: A1B2C3D4E5"
              className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              dir="ltr"
              inputMode="text"
              autoComplete="off"
            />
            <Button type="button" className="h-11 font-bold" onClick={() => applyCode(input)}>
              Apply
            </Button>
          </div>
          <div className="mt-2 text-xs text-white/65 rtl-text text-right">
            דער קאָד ווערט געראטעוועט פאר 30 טעג און ווערט געשיקט ביים Signup.
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/10 p-4">
          <div className="text-sm font-bold text-white/90 rtl-text text-right">דיין Invite Link</div>
          {myCode ? (
            <>
              <div className="mt-2 text-xs text-white/70 rtl-text text-right">
                Referral code: <span className="font-mono text-white">{myCode}</span>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap justify-end">
                <Button type="button" variant="outline" className="h-10 bg-white/5 border-white/20 text-white" onClick={() => copy(inviteLink)}>
                  Copy link
                </Button>
                <Button type="button" className="h-10 font-bold" onClick={() => copy(myCode)}>
                  Copy code
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-white/75 rtl-text text-right leading-6">
              <span className="font-semibold">Log in</span> כדי צו זען דיין אייגענע referral link.
              <div className="mt-3 flex justify-end">
                <Link
                  href={getLoginHref()}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-full bg-white/10 border border-white/20 text-white font-bold hover:bg-white/15 transition"
                >
                  גיין צו לאגין
                </Link>
              </div>
            </div>
          )}
          <div className="mt-2 text-[11px] text-white/55 rtl-text text-right">
            Note: inviting doesn’t bypass verification; it just helps attribution + growth tracking.
          </div>
        </div>
      </div>
    </div>
  )
}


