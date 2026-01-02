import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Heebo } from 'next/font/google'
import { getAppUrl } from '@/lib/app-url'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/LanguageProvider'
import { InsightBusProvider } from '@/components/InsightBusProvider'
import { DEFAULT_LANGUAGE, normalizeLanguage } from '@/lib/i18n'
import { getSupabaseRuntimeConfig } from '@/lib/runtime-env'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import SessionIdleManager from '@/components/SessionIdleManager'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'UnityCredit | Enterprise Financial Services',
  description: 'Professional enterprise-level financial services with advanced security',
  keywords: ['credit', 'financial services', 'credit cards', 'financial planning'],
  authors: [{ name: 'UnityCredit' }],
  creator: 'UnityCredit',
  publisher: 'UnityCredit',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(getAppUrl()),
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    title: 'UnityCredit',
    description: 'Professional enterprise-level financial services',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Next.js 15.5+: `cookies()` is async and must be awaited.
  const cookieStore = await cookies()
  const langCookie = cookieStore.get('uc_lang')?.value || DEFAULT_LANGUAGE
  const lang = normalizeLanguage(langCookie)
  const dir = lang === 'yi' ? 'rtl' : 'ltr'
  const supabaseCfg = getSupabaseRuntimeConfig()
  const publicSupabase = {
    url: supabaseCfg.url || '',
    anonKey: supabaseCfg.anonKey || '',
  }

  return (
    <html lang={lang} dir={dir} className="dark" suppressHydrationWarning>
      <body className={`${heebo.className} antialiased`}>
        <LanguageProvider initialLang={lang}>
          <InsightBusProvider>
            {/* Client-side session safety: idle logout + keepalive while active */}
            <SessionIdleManager idleMinutes={30} pingMinutes={5} />
            {/* Public runtime injection (non-secret): helps client-side Supabase anon usage even if env isn't baked into the bundle. */}
            <script
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: `window.__UC_SUPABASE__=${JSON.stringify(publicSupabase)};`,
              }}
            />
            {children}
            <footer className="mt-10 border-t border-slate-200 bg-white/70 px-6 py-6">
              <div className="max-w-7xl mx-auto text-xs text-slate-600 flex flex-col items-center gap-2">
                <UnityCreditBrandStack size="sm" label="UnityCredit" aria-label="UnityCredit" />
                <div>© {new Date().getFullYear()}. All rights reserved. Proprietary &amp; Trade Secret.</div>
              </div>
            </footer>
          </InsightBusProvider>
        </LanguageProvider>
        <Toaster />
      </body>
    </html>
  )
}

