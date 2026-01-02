'use server'

import { cookies } from 'next/headers'
import { DEFAULT_LANGUAGE, normalizeLanguage, type AppLanguage } from '@/lib/i18n'

export async function setLanguageAction(lang: AppLanguage) {
  const safe = normalizeLanguage(lang)
  const cookieStore = await cookies()
  cookieStore.set('uc_lang', safe, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return { ok: true, lang: safe }
}

export async function getLanguageAction(): Promise<{ lang: AppLanguage }> {
  const cookieStore = await cookies()
  const c = cookieStore.get('uc_lang')?.value
  return { lang: normalizeLanguage(c || DEFAULT_LANGUAGE) }
}


