'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getDictionary, type AppLanguage, normalizeLanguage } from '@/lib/i18n'
import { setLanguageAction } from '@/lib/actions/language'

type I18nCtx = {
  lang: AppLanguage
  dir: 'rtl' | 'ltr'
  t: (key: string) => string
  setLang: (lang: AppLanguage) => Promise<void>
}

const I18nContext = createContext<I18nCtx | null>(null)

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: AppLanguage
  children: React.ReactNode
}) {
  const [lang, setLangState] = useState<AppLanguage>(normalizeLanguage(initialLang))

  const dir: 'rtl' | 'ltr' = lang === 'yi' ? 'rtl' : 'ltr'
  const dict = useMemo(() => getDictionary(lang), [lang])

  const t = useCallback(
    (key: string) => {
      return dict[key] ?? key
    },
    [dict]
  )

  const setLang = useCallback(async (next: AppLanguage) => {
    const safe = normalizeLanguage(next)
    setLangState(safe)
    // Persist for SSR (layout reads cookie on next request)
    await setLanguageAction(safe)
  }, [])

  // Keep <html> in sync on the client for instant UX.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const value = useMemo<I18nCtx>(() => ({ lang, dir, t, setLang }), [lang, dir, t, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}


