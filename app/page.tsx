import Link from 'next/link'
import { redirect } from 'next/navigation'
import ReferralWelcomeCard from '@/components/ReferralWelcomeCard'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'

export default function Home() {
  // INDEPENDENT OPERATION MODE (dev): always show the login screen at http://localhost:3002
  if (process.env.NODE_ENV !== 'production') redirect('/login')

  // Dev convenience: if guest mode is enabled, jump straight to the dashboard.
  const guestMode =
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_DEV_GUEST_MODE === 'true' ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (guestMode) redirect('/dashboard')

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] text-white">
      {/* animated backdrop (CSS-only, very lightweight) */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-emerald-400/30 blur-3xl animate-pulse" />
        <div className="absolute top-24 -right-32 h-[520px] w-[520px] rounded-full bg-sky-400/25 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-160px] left-1/3 h-[520px] w-[520px] rounded-full bg-gold/20 blur-3xl animate-pulse" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <UnityCreditBrandStack
            size="md"
            label="UnityCredit"
            className="text-white"
            textClassName="text-white"
            aria-label="UnityCredit"
          />
          <div className="text-sm text-white/80">Enterprise • Private • Secure</div>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight rtl-text text-right">
              A private, professional finance super‑app
            </h1>
            <p className="text-white/85 text-lg rtl-text text-right leading-8">
              דער <span className="font-bold text-gold">היימישער בודזשעט</span>, Plaid־באַנק אנאליז,
              און <span className="font-bold text-emerald-300">אייער פינאַנציעלער קאָנטראָל־צענטער</span> — אלעס אין איין פלאץ.
            </p>

            <div className="flex gap-3 justify-end flex-wrap rtl-text">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-gradient-to-r from-gold to-gold-dark text-primary font-black shadow-xl shadow-gold/30 hover:shadow-gold/50 transition"
              >
                <span>Secure login</span>
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white/10 border border-white/20 text-white font-bold hover:bg-white/15 transition"
              >
                <span>Create account</span>
              </Link>
              <Link
                href="/status"
                className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-white/5 border border-white/15 text-white/90 font-semibold hover:bg-white/10 transition"
              >
                <span className="rtl-text">System Status</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="font-black text-gold rtl-text text-right">פריוואטקייט</div>
                <div className="text-xs text-white/80 rtl-text text-right mt-1">קיין קרעדיט־רעפארטן נישט. קיינער זעט נישט אייערע קי־סודות.</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="font-black text-emerald-200 rtl-text text-right">Verification Nodes</div>
                <div className="text-xs text-white/80 rtl-text text-right mt-1">5‑מודעל זיכערהייט־איבעררייד און אודיט־טרעיל.</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="font-black text-sky-200 rtl-text text-right">סאב‑500ms</div>
                <div className="text-xs text-white/80 rtl-text text-right mt-1">סטאטוס &amp; קאָר־פּאַגעס מיט קורצע קעשינג און לייט־UI.</div>
              </div>
            </div>

            <div className="pt-2">
              <ReferralWelcomeCard />
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl">
              <div className="text-sm font-bold text-white/80 rtl-text text-right">Enterprise Preview</div>
              <div className="mt-3 rounded-2xl bg-white/10 p-5 border border-white/10">
                <div className="flex items-center justify-between">
                  <UnityCreditBrandStack
                    size="sm"
                    label="UnityCredit"
                    className="text-white"
                    textClassName="text-white"
                    aria-label="UnityCredit"
                  />
                  <div className="text-xs font-bold text-white/80">v1</div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-3 w-2/3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse" />
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-3 w-1/2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 animate-pulse" />
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-3 w-3/4 rounded-full bg-gradient-to-r from-gold to-gold-dark animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-white/70 rtl-text text-right">
                  דער סיסטעם העלפט אייך געפינען סאווינגס מיט א קלארע אודיט־טרעיל.
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-3xl bg-emerald-400/20 blur-2xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

