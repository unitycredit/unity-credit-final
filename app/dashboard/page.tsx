'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getCurrentUser } from '@/lib/actions/auth'
import { getCreditCards, createCreditCard, deleteCreditCard } from '@/lib/actions/cards'
import Navbar from '@/components/Navbar'
import CreditCardForm from '@/components/CreditCardForm'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import ReadOnlyPaywall from '@/components/ReadOnlyPaywall'
import TransactionHistoryCard from '@/components/TransactionHistoryCard'
import HeimisheExpensesDropdown from '@/components/HeimisheExpensesDropdown'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { ComponentProps } from 'react'
const UnitySavingsFinder = dynamic(() => import('@/components/UnitySavingsFinder'), {
  ssr: false,
  loading: () => (
    <I18nLoadingCard textKey="dashboard.loading.savingsFinder" />
  ),
})
import BankConnectionPlaceholder from '@/components/BankConnectionPlaceholder'
import SpendingVsIncomeCard from '@/components/SpendingVsIncomeCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from '@/components/LanguageProvider'
import {
  Trash2,
  CreditCard,
  TrendingUp,
  Wallet,
  Shield,
  Zap,
  Bell,
  ShieldCheck,
  Download,
} from 'lucide-react'
import type { CreditCardInput } from '@/lib/validations'
import dynamic2 from 'next/dynamic'
import { bankSummarySchema, creditCardRowSchema, type BankSummary, type CreditCard as FinanceCreditCard } from '@/lib/finance/types'
// NOTE: Credit math rules are centralized in Unity Brain Office.
import { toFiniteNonNegativeNumber } from '@/lib/finance/number'
import AiAdviceBox from '@/components/AiAdviceBox'
import SmartSavingsRealtime from '@/components/SmartSavingsRealtime'
import { getSupabaseAnonClient } from '@/lib/supabase-browser'
import { getLocalSession } from '@/lib/local-session'
import { MOCK_BANK_INSIGHTS, MOCK_CARDS, MOCK_USER } from '@/constants/mockData'
import { REQUIRE_BRAIN_APPROVAL_UI } from '@/lib/autonomous-ui'

function I18nLoadingCard(props: { textKey: string }) {
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 rtl-text text-right text-sm text-slate-600">
      {t(props.textKey)}
    </div>
  )
}

const ActiveSavingsFeed = dynamic2(() => import('@/components/ActiveSavingsFeed'), {
  ssr: false,
  loading: () => (
    <I18nLoadingCard textKey="dashboard.loading.activeSavings" />
  ),
})

const SmartAlertsPanel = dynamic2(() => import('@/components/SmartAlertsPanel'), {
  ssr: false,
  loading: () => (
    <I18nLoadingCard textKey="dashboard.loading.smartAlerts" />
  ),
})

const MonthlySavingsSummary = dynamic2(() => import('@/components/MonthlySavingsSummary'), {
  ssr: false,
  loading: () => (
    <I18nLoadingCard textKey="dashboard.loading.monthlySavingsSummary" />
  ),
})

type CreditCard = FinanceCreditCard

type BudgetRow = {
  source: 'weekly' | 'monthly' | 'yearly' | null
  auto?: boolean
  weekly: string
  monthly: string
  yearly: string
}

type BudgetItem = {
  key: string
  yi: string
}

const WEEKS_PER_MONTH = 4.33
const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12
const DEV_DEMO_CARDS: CreditCard[] = [
  { id: 'demo-1', last4: '4242', name: 'Chase Sapphire Preferred', apr: 26.24, limit: 18000, balance: 6200 },
  { id: 'demo-2', last4: '1111', name: 'Amex Blue Cash', apr: 19.99, limit: 12000, balance: 2100 },
  { id: 'demo-3', last4: '2222', name: 'Capital One Venture', apr: 24.49, limit: 9000, balance: 4300 },
]

function toNum(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

function money2(n: number) {
  return n.toFixed(2)
}

function computeFrom(source: Exclude<BudgetRow['source'], null>, value: number) {
  if (source === 'weekly') {
    return {
      weekly: money2(value),
      monthly: money2(value * WEEKS_PER_MONTH),
      yearly: money2(value * WEEKS_PER_YEAR),
    }
  }
  if (source === 'monthly') {
    return {
      weekly: money2(value / WEEKS_PER_MONTH),
      monthly: money2(value),
      yearly: money2(value * MONTHS_PER_YEAR),
    }
  }
  return {
    weekly: money2(value / WEEKS_PER_YEAR),
    monthly: money2(value / MONTHS_PER_YEAR),
    yearly: money2(value),
  }
}

const LEGAL_DISCLAIMER_YI = 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.'

// NOTE: This list is the "full list" currently present in the repo.
// If you paste the exact full list from the images, you can import it in the UI and it will render 1:1.
const DEFAULT_HEIMISHE_BUDGET_ITEMS: BudgetItem[] = [
  // Heimishe / community
  { key: 'maaser', yi: 'מעשר' },
  { key: 'tzedakah', yi: 'צדקה / צדקה־הוצאות' },
  { key: 'shulDues', yi: 'שול דיעס / חברותא' },
  { key: 'mikveh', yi: 'מקוה געלט' },
  { key: 'kollelPocket', yi: 'כולל / פּאָקעט־געלט' },
  { key: 'scharLimud', yi: 'שכר לימוד' },
  { key: 'schoolSupplies', yi: 'סקול־סופלייז' },
  { key: 'tutoring', yi: 'טוטאָרינג / לעקציעס' },
  { key: 'seforim', yi: 'ספרים / ספֿרים' },
  { key: 'campAfterSchool', yi: 'קעמפּ / אפטער־סקול' },
  { key: 'childcare', yi: 'דעי־קేర్ / בעביסיטינג' },
  { key: 'diapersFormula', yi: 'דייפּערס / פאָרמולע' },

  // Shabbos / Yom Tov / Simchos
  { key: 'shabbosYomtov', yi: 'הוצאות שבת ויום טוב' },
  { key: 'goyte', yi: 'גויטע (פסח/חודש)' },
  { key: 'simchas', yi: 'שמחות / משפחה־איוונטן' },
  { key: 'marriedKids', yi: 'חתונה מאכן קינדער' },
  { key: 'barMitzvah', yi: 'בר מצוה / בת מצוה' },
  { key: 'brisPidyon', yi: 'ברית / פדיון הבן' },
  { key: 'gifts', yi: 'מתנות' },

  // Housing
  { key: 'rentMortgage', yi: 'דירה (רענט/מארטגעדזש)' },
  { key: 'propertyTax', yi: 'טאַקס (פּראָפּערטי)' },
  { key: 'repairsHome', yi: 'היים־רעפּאַרס / מיינטענאַנס' },
  { key: 'furniture', yi: 'מאָבל / פֿערניטשער' },
  { key: 'appliances', yi: 'אַפּפּליאַנסעס' },
  { key: 'movingStorage', yi: 'מאָווינג / סטאָרידזש' },

  // Utilities / Communications
  { key: 'utilities', yi: 'יוטיליטיס (עלעקטריק/גאז/וואסער)' },
  { key: 'phoneInternet', yi: 'טעלעפאן / אינטערנעט' },
  { key: 'cellPhones', yi: 'סעל־פאָונס / פּלאַנז' },
  { key: 'filtering', yi: 'פילטערינג / אינטרנט־פּראָטעקשאַן' },
  { key: 'subscriptions', yi: 'סאַבסקריפּשאַנז' },

  // Food / Household
  { key: 'groceries', yi: 'עסן (גראָסעריס)' },
  { key: 'paperGoods', yi: 'פּאַפּיר־גודס' },
  { key: 'cleaningSupplies', yi: 'קלינינג־סופלייז' },
  { key: 'laundry', yi: 'וואַש / דרײַ־קלינינג' },

  // Transportation
  { key: 'transport', yi: 'טראנספּאָרט (קאר/גאז/אויפהאלט)' },
  { key: 'gas', yi: 'גאַז' },
  { key: 'carPayment', yi: 'קאַר־פּיימענט' },
  { key: 'carMaintenance', yi: 'קאַר־רעפּאַרס / מיינטענאַנס' },
  { key: 'tollsParking', yi: 'טאָלס / פּאַרקינג' },
  { key: 'publicTransit', yi: 'פּובליק־טראַנספּאָרט' },

  // Insurance / Health
  { key: 'carInsurance', yi: 'קאר־אינשורענס' },
  { key: 'healthInsurance', yi: 'געזונט־אינשורענס' },
  { key: 'lifeInsurance', yi: 'לייף־אינשורענס' },
  { key: 'homeInsurance', yi: 'היים־אינשורענס' },
  { key: 'medical', yi: 'דאקטוירים / מעדיצינען' },
  { key: 'dental', yi: 'דענטל' },
  { key: 'vision', yi: 'וויזשאַן' },
  { key: 'therapy', yi: 'טעראַפּי / קאונסעלינג' },

  // Personal
  { key: 'clothing', yi: 'קליידער' },
  { key: 'shoes', yi: 'שיך' },
  { key: 'haircuts', yi: 'האָרקאַטס' },

  // Finance / Admin
  { key: 'bankFees', yi: 'באַנק־פֿיס' },
  { key: 'creditFees', yi: 'קרעדיט־קאַרד פֿיס / אינטערעסט' },
  { key: 'taxPrep', yi: 'טאַקס־פּרעפּ / אַקאַונטינג' },
  { key: 'legalFees', yi: 'לעגאַל פֿיס' },

  // Misc
  { key: 'vacation', yi: 'וואַקאַציע / טראַוועל' },
  { key: 'entertainment', yi: 'ענטערטֵּיינמענט' },
  { key: 'other', yi: 'אנדערע' },
]

function slugKey(input: string) {
  // Keep this regex ES5/ES6 compatible (no unicode property escapes) for older TS targets.
  // If the label is non-latin, we'll fall back to a timestamp key.
  const base = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || `cat-${Date.now()}`
}

function normText(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew niqqud/cantillation
    .replace(/['"’”“]/g, '')
    // Keep ASCII + Hebrew letters/numbers; avoid unicode property escapes for older TS targets.
    .replace(/[^a-z0-9\u0590-\u05FF\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [bankSyncingUi, setBankSyncingUi] = useState(false)
  const [bankRefreshingUi, setBankRefreshingUi] = useState(false)
  // Autonomous UI: render immediately from mock data, then optionally hydrate from network.
  const [user, setUser] = useState<any>(MOCK_USER)
  const [cards, setCards] = useState<CreditCard[]>(MOCK_CARDS as any)
  const [loading, setLoading] = useState(false)

  // Guest mode detection:
  // - In production, we still want guest sessions (created via "Enter as Guest") to bypass Supabase calls,
  //   otherwise the UI will hit authenticated endpoints and show "Unauthorized".
  // - We treat either the bypass cookie OR a local session email starting with "guest@" as guest mode.
  const bypassCookieEnabled =
    typeof document !== 'undefined' && /(?:^|;\s*)uc_dev_bypass=1(?:;|$)/.test(document.cookie || '')
  let localSessionEmail = ''
  try {
    if (typeof window !== 'undefined') {
      localSessionEmail = String(getLocalSession()?.email || '').trim().toLowerCase()
    }
  } catch {
    // ignore
  }
  const guestSessionActive = bypassCookieEnabled || localSessionEmail.startsWith('guest@')

  // Dev UX: default to guest/demo data so UI can be polished without auth/session setup.
  // To force real auth in dev, set NEXT_PUBLIC_DEV_GUEST_MODE=false
  const allowGuest =
    guestSessionActive ||
    process.env.NEXT_PUBLIC_DEV_GUEST_MODE === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_GUEST_MODE !== 'false')

  const [heimisheBudgetItems, setHeimisheBudgetItems] = useState<BudgetItem[]>(DEFAULT_HEIMISHE_BUDGET_ITEMS)
  const [heimisheImportText, setHeimisheImportText] = useState('')

  const [heimisheBudget, setHeimisheBudget] = useState<Record<string, BudgetRow>>(() => {
    const init: Record<string, BudgetRow> = {}
    for (const it of DEFAULT_HEIMISHE_BUDGET_ITEMS) {
      init[it.key] = { source: null, auto: false, weekly: '', monthly: '', yearly: '' }
    }
    return init
  })

  // Centralized copy for future localization
  const copy = {
    smartSavings: 'קלוגע סאַווינגס',
    highInterestWarnings: 'וואָרענונגען וועגן הויכע ריביות',
    insuranceComparison: 'אינשורענס־קאָמפּאַריזאָן',
    creditRoadmap: 'קרעדיט־פּלאַן',
    monthlySavingsPlan: 'מאָנאַטלעכער סאַווינגס־פּלאַן',
    downloadFinancialReport: 'אַראָפקאָפּירן פינאַנציעלן רעפּאָרט',
    aprWarning: 'קאַרטן העכער 20% APR',
    aprNotProvided: 'APR איז נישט געגעבן פאר געוויסע קאַרטן — מיר נעמען א סטאַנדאַרט־שאַצונג.',
    insuranceInputLabel: 'אייער מאָנאַטליכער אינשורענס־ביל',
    insuranceSuggestion: 'פֿינאַנציעלע אַנאַליז שätzt א 15% סאַווינגס אויף אינשורענס',
    utilizationNow: 'ניצונג־פּראָצענט היינט',
    utilizationGoal: 'ציל: אונטער 30%',
    payToGoal: 'צו באַצאָלן כדי צו דערגרייכן דעם ציל',
    preparingPdfTitle: 'גרייט־מאַכן PDF',
    preparingPdfDesc: 'אייער פינאַנציעלער רעפּאָרט ווערט צוגעגרייט…',
    pdfErrorTitle: 'PDF טעות',
    pdfErrorDesc: 'עס איז נישט געלונגען צו אַראָפּלאָדן דעם רעפּאָרט. ביטע פרובירט נאכאמאל.',
    creditAccess: 'קרעדיט־צוטריט',
    bankConnectedHint: 'באזירט אויף באנק דאטן',
    bankSavingsAdviceTitle: 'סאווינגס עצה (לויט באנק־טראַנזאַקציעס)',
    bankSavingsAdviceDesc: 'דער טייל ווערט אויטאמאטיש דערהיינטיקט נאכדעם וואס א באנק ווערט פארבונדן.',
    topSpendingCategories: 'גרעסטע הוצאה־קאטעגאריעס',
    lastUpdated: 'לעצטע דערהיינטיגונג',
  } as const

  const DEFAULT_APR = 22 // percent
  const HIGH_APR = 20 // percent

  const [insuranceMonthly, setInsuranceMonthly] = useState<number>(0)
  const [incomeMonthly, setIncomeMonthly] = useState<number>(6000)
  const [expensesMonthly, setExpensesMonthly] = useState<number>(4200)
  const [reportTimestamp, setReportTimestamp] = useState<string>(() => new Date().toISOString())
  const [bankInsights, setBankInsights] = useState<BankSummary | null>(MOCK_BANK_INSIGHTS as any)
  const [brainHandshakeState, setBrainHandshakeState] = useState<'unknown' | 'pending' | 'active' | 'error'>(
    REQUIRE_BRAIN_APPROVAL_UI ? 'unknown' : 'active'
  )
  const [brainHandshakeMsg, setBrainHandshakeMsg] = useState<string | null>(null)
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0)
  const [brainOnline, setBrainOnline] = useState<boolean>(false)

  // Credit Score (Self-Report only; no credit reports pulled)
  const [selfReportedScore, setSelfReportedScore] = useState<number | ''>('')

  // Privacy Mode (mask sensitive fields on-screen)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [legalDisclaimerYI, setLegalDisclaimerYI] = useState(LEGAL_DISCLAIMER_YI)
  const [adminHeimisheCats, setAdminHeimisheCats] = useState<string[] | null>(null)

  const maskMoney = (n: number) => (privacyMode ? '***' : `$${n.toFixed(0)}`)

  const heimisheCategorySummaries = useMemo(() => {
    return heimisheBudgetItems.map((it) => {
      const row = heimisheBudget[it.key]
      if (!row?.source) return { label: it.yi, monthly: 0 }
      const base = toNum((row as any)[row.source])
      if (base === null) return { label: it.yi, monthly: 0 }
      const computed = computeFrom(row.source, base)
      const m = Number(computed.monthly)
      return { label: it.yi, monthly: Number.isFinite(m) ? m : 0 }
    })
  }, [heimisheBudget, heimisheBudgetItems])

  // Brain reachability probe. If Brain is offline/slow, we fall back to local mock data.
  useEffect(() => {
    if (allowGuest) return
    let cancelled = false
    const ctrl = new AbortController()
    const id = window.setTimeout(() => ctrl.abort(), 1200)
    fetch('/api/brain/health', { cache: 'no-store', signal: ctrl.signal as any })
      .then((r) => {
        if (cancelled) return
        setBrainOnline(Boolean(r.ok))
      })
      .catch(() => {
        if (cancelled) return
        setBrainOnline(false)
      })
      .finally(() => window.clearTimeout(id))
    return () => {
      cancelled = true
      window.clearTimeout(id)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowGuest])

  useEffect(() => {
    checkUser().catch(() => null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Brain handshake + approval listener (poll until admin approves).
  useEffect(() => {
    if (allowGuest) return
    if (!REQUIRE_BRAIN_APPROVAL_UI) {
      // Disable mandatory "Brain approval" gating for initial page load.
      setBrainHandshakeState('active')
      setBrainHandshakeMsg(null)
      return
    }
    let cancelled = false
    let timer: any = null

    async function tick() {
      try {
        const res = await fetch('/api/brain/handshake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return

        if (res.status === 200 && (json as any)?.state === 'active') {
          setBrainHandshakeState('active')
          setBrainHandshakeMsg(null)
          return
        }
        if (res.status === 403 && (json as any)?.state === 'pending') {
          setBrainHandshakeState('pending')
          // Product copy requirement: show a graceful fallback when the Brain isn't approved yet.
          setBrainHandshakeMsg('Unity Intelligence is currently optimizing your data...')
          timer = window.setTimeout(tick, 5000)
          return
        }

        setBrainHandshakeState('error')
        setBrainHandshakeMsg('Unity Intelligence is currently optimizing your data...')
      } catch (e: any) {
        if (cancelled) return
        setBrainHandshakeState('error')
        setBrainHandshakeMsg('Unity Intelligence is currently optimizing your data...')
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [allowGuest])

  // Core functionality: keep Credit Hub + Bank Summary synced from Supabase (no hard-coded numbers).
  // This is lightweight polling (avoids requiring Supabase Realtime session wiring).
  useEffect(() => {
    if (allowGuest) return
    if (!user?.email) return
    const id = window.setInterval(() => {
      fetchCards().catch(() => null)
      fetchBankSummary().catch(() => null)
    }, 15_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowGuest, user?.email])

  // Load admin-configured public settings (disclaimer + optional default categories)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/public/settings')
        const json = await res.json().catch(() => ({}))
        const d = String(json?.settings?.disclaimer_yi || '').trim()
        const cats = Array.isArray(json?.settings?.heimishe_categories)
          ? json.settings.heimishe_categories.map(String)
          : []
        if (cancelled) return
        if (d) setLegalDisclaimerYI(d)
        setAdminHeimisheCats(cats.length > 0 ? cats : null)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // If admin provided categories AND user hasn't customized yet, swap defaults once.
  useEffect(() => {
    if (!adminHeimisheCats || adminHeimisheCats.length === 0) return
    if (heimisheImportText.trim()) return

    // Only swap if everything is still empty (no user data entered yet)
    const hasAnyValue = heimisheBudgetItems.some((it) => {
      const r = heimisheBudget[it.key]
      return Boolean(r?.weekly || r?.monthly || r?.yearly)
    })
    if (hasAnyValue) return

    // Keep the full default list, and append any admin-provided categories not already present.
    const defaults = DEFAULT_HEIMISHE_BUDGET_ITEMS
    const byNorm = new Map(defaults.map((it) => [normText(it.yi), it]))
    const items: BudgetItem[] = [...defaults]

    const seenKey = new Set(items.map((x) => x.key))
    for (const yi of adminHeimisheCats) {
      const n = normText(yi)
      if (n && byNorm.has(n)) continue // already in default list

      const base = slugKey(yi)
      let key = base
      let i = 2
      while (seenKey.has(key)) {
        key = `${base}-${i}`
        i += 1
      }
      seenKey.add(key)
      items.push({ key, yi })
    }

    setHeimisheBudgetItems(items)
    setHeimisheBudget(() => {
      const init: Record<string, BudgetRow> = {}
      for (const it of items) init[it.key] = { source: null, auto: false, weekly: '', monthly: '', yearly: '' }
      return init
    })
  }, [adminHeimisheCats])

  // Persist Privacy Mode across refreshes (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('uc_privacy_mode_v1')
      if (raw === 'true') setPrivacyMode(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('uc_privacy_mode_v1', String(privacyMode))
    } catch {
      // ignore
    }
  }, [privacyMode])

  const checkUser = async () => {
    // Primary path: populate dashboard from local mock data immediately.
    const local = getLocalSession()
    setUser(local?.email ? { ...MOCK_USER, email: local.email } : MOCK_USER)
    setCards(MOCK_CARDS as any)
    setBankInsights(MOCK_BANK_INSIGHTS as any)
    setReportTimestamp(new Date().toISOString())
    setLoading(false)

    // TEMP (requested): do not redirect to /login (or /verify-email) at all.
    // Keep dashboard browsable without any authentication.
    return
  }

  async function runBrainTestSync() {
    try {
      toast({ title: 'Test Sync', description: 'Sending to Unity Brain for Analysis...' })
      const res = await fetch('/api/brain/analyze/test-one', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: 'Test Sync failed', description: String((json as any)?.error || 'Brain request failed'), variant: 'destructive' })
        return
      }
      toast({ title: 'Test Sync complete', description: 'Check the browser console for the Brain response.' })
    } catch (e: any) {
      toast({ title: 'Test Sync error', description: e?.message || 'Failed', variant: 'destructive' })
    }
  }

  const fetchCards = async () => {
    try {
      const result = await getCreditCards()
      if (result.error) {
        toast({
          title: 'טעות',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        const got = (result.cards || []) as any[]
        const parsed: CreditCard[] = []
        let skipped = 0
        for (const row of got) {
          const res = creditCardRowSchema.safeParse(row)
          if (res.success) parsed.push(res.data)
          else skipped += 1
        }
        setCards(parsed)
        if (skipped > 0) {
          toast({
            title: 'Syncing…',
            description: `${skipped} record(s) were skipped due to invalid card data.`,
          })
        }
      }
    } catch (error) {
      toast({
        title: 'טעות',
        description: 'עס איז נישט געלונגען צו לאָדן די קרעדיט קארטלעך.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchBankSummary = async () => {
    if (allowGuest) return
    try {
      const res = await fetch('/api/bank/summary', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return
      const raw = {
        ...(json?.summary || {}),
        transactions_preview: Array.isArray(json?.transactions_preview) ? json.transactions_preview : undefined,
      }
      const parsed = bankSummarySchema.safeParse(raw)
      if (parsed.success) handleBankSummary(parsed.data as any)

      const sync = (json as any)?.sync_state
      if (sync?.status === 'reconnect_required') {
        toast({
          title: 'Re-connect Required',
          description: 'Your bank connection needs to be reconnected to keep data live.',
          variant: 'destructive',
        })
      }
    } catch {
      // ignore: bank may not be connected yet
    }
  }

  const handleAddCard = async (cardData: CreditCardInput) => {
    if (allowGuest) {
      // Local-only cards in guest mode (no DB).
      const id = `guest-${Date.now()}`
      setCards((prev) => [
        ...prev,
        {
          id,
          last4: cardData.last4,
          name: cardData.name,
          apr: cardData.apr ?? null,
          limit: cardData.limit,
          balance: cardData.balance,
        },
      ])
      toast({ title: 'גאַסט־מאָדע', description: 'דער קאַרטל איז צוגעגעבן געוואָרן (לאָקאַל).' })
      return
    }
    const result = await createCreditCard(cardData)

    if (result.error) {
      toast({
        title: 'טעות',
        description: result.error,
        variant: 'destructive',
      })
      throw new Error(result.error)
    } else {
      await fetchCards()
      toast({
        title: 'געראטן',
        description: 'די קארטל איז צוגעלייגט געווארן.',
      })
    }
  }

  const handleDeleteCard = async (id: string) => {
    if (allowGuest) {
      setCards((prev) => prev.filter((c) => c.id !== id))
      toast({ title: 'גאַסט־מאָדע', description: 'דער קאַרטל איז אויסגעמעקט געוואָרן (לאָקאַל).' })
      return
    }
    const result = await deleteCreditCard(id)

    if (result.error) {
      toast({
        title: 'טעות',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      await fetchCards()
      toast({
        title: 'געראטן',
        description: 'די קארטל איז אויסגעמעקט געווארן.',
      })
    }
  }

  const [creditSummary, setCreditSummary] = useState<{
    totalLimit: number
    totalBalance: number
    totalAvailable: number
    utilizationPct: number
    payTo30: number
  } | null>(null)
  const [creditScoreEstimate, setCreditScoreEstimate] = useState<number | null>(null)

  useEffect(() => {
    // Always compute a local credit summary so the dashboard renders even when Brain is offline.
    const totalLimitLocal = cards.reduce((sum, c) => sum + (Number(c.limit) || 0), 0)
    const totalBalanceLocal = cards.reduce((sum, c) => sum + (Number(c.balance) || 0), 0)
    const totalAvailableLocal = Math.max(0, totalLimitLocal - totalBalanceLocal)
    const utilizationPctLocal = totalLimitLocal > 0 ? Math.max(0, Math.min(100, (totalBalanceLocal / totalLimitLocal) * 100)) : 0
    const payTo30Local = Math.max(0, totalBalanceLocal - totalLimitLocal * 0.3)

    setCreditSummary({
      totalLimit: totalLimitLocal,
      totalBalance: totalBalanceLocal,
      totalAvailable: totalAvailableLocal,
      utilizationPct: utilizationPctLocal,
      payTo30: payTo30Local,
    })

    // Lightweight on-device estimate (not a credit report).
    const estimated = Math.round(850 - utilizationPctLocal * 2.2)
    setCreditScoreEstimate(Number.isFinite(estimated) ? Math.max(300, Math.min(850, estimated)) : null)

    // Optional: hydrate from Unity Brain Office when available (best-effort).
    if (allowGuest) return
    if (!brainOnline) return
    if (REQUIRE_BRAIN_APPROVAL_UI && brainHandshakeState !== 'active') return

    ;(async () => {
      try {
        const payload = {
          cards: cards.map((c) => ({ limit: Number(c.limit) || 0, balance: Number(c.balance) || 0 })),
        }
        const res = await fetch('/api/finance/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return
        const c = (json as any)?.snapshot?.credit
        const est = (json as any)?.snapshot?.derived?.credit_score_estimate
        if (c && typeof c.totalLimit === 'number') setCreditSummary(c)
        setCreditScoreEstimate(typeof est === 'number' && Number.isFinite(est) ? est : null)
      } catch {
        // ignore
      }
    })()
    // Re-run when realtimeRefreshKey bumps (e.g., after Brain/bank computations complete).
  }, [allowGuest, brainOnline, brainHandshakeState, cards, realtimeRefreshKey])

  // Realtime: when the Brain (or other device) updates underlying tables, refresh immediately.
  useEffect(() => {
    if (allowGuest) return
    const userId = String((user as any)?.id || '').trim()
    if (!userId) return
    const { client } = getSupabaseAnonClient()
    if (!client) return

    let timer: any = null
    const bump = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => setRealtimeRefreshKey((k) => k + 1), 250)
    }

    const ch = client
      .channel(`uc-dashboard-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards', filter: `user_id=eq.${userId}` }, () => {
        fetchCards().catch(() => null)
        bump()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plaid_transactions', filter: `user_id=eq.${userId}` }, () => {
        fetchBankSummary().catch(() => null)
        bump()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_sync_state', filter: `user_id=eq.${userId}` }, () => {
        fetchBankSummary().catch(() => null)
        bump()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_savings_snapshots', filter: `user_id=eq.${userId}` }, () => bump())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_savings_events', filter: `user_id=eq.${userId}` }, () => bump())
      // If Brain persists computed insights into the shared schema, refresh Unity Intelligence widgets immediately.
      .on('postgres_changes', { event: '*', schema: 'unity_brain', table: 'insights', filter: `user_id=eq.${userId}` }, () => bump())
      .subscribe()

    return () => {
      if (timer) window.clearTimeout(timer)
      client.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowGuest, (user as any)?.id])

  const totalLimit = creditSummary?.totalLimit ?? 0
  const totalBalance = creditSummary?.totalBalance ?? 0
  const totalAvailable = creditSummary?.totalAvailable ?? 0
  const utilization = creditSummary?.utilizationPct ?? 0

  const normalizedCards = useMemo(() => {
    return cards.map((c) => ({
      ...c,
      aprPct: typeof c.apr === 'number' && Number.isFinite(c.apr) ? c.apr : DEFAULT_APR,
    }))
  }, [cards])

  const highAprCards = useMemo(() => {
    return normalizedCards
      .filter((c) => c.aprPct > HIGH_APR)
      .sort((a, b) => b.aprPct - a.aprPct)
  }, [normalizedCards])

  const payTo30 = creditSummary?.payTo30 ?? 0

  const insuranceSavings = useMemo(() => {
    return Math.max(0, insuranceMonthly) * 0.15
  }, [insuranceMonthly])

  const spendingSavings = useMemo(() => {
    const inc = Number.isFinite(incomeMonthly) ? incomeMonthly : 0
    const exp = Number.isFinite(expensesMonthly) ? expensesMonthly : 0
    return inc - exp
  }, [incomeMonthly, expensesMonthly])

  const bankBasedAdvice = useMemo(() => {
    if (!bankInsights) return null

    const inc = typeof bankInsights.monthly_income === 'number' ? bankInsights.monthly_income : incomeMonthly
    const exp = typeof bankInsights.monthly_expenses === 'number' ? bankInsights.monthly_expenses : expensesMonthly
    const net = inc - exp

    const top = bankInsights.top_spend_categories?.[0]
    const insurance = bankInsights.insurance_estimate || 0

    const bullets: string[] = []

    if (net < 0) {
      bullets.push(
        `איר זענט בערך $${Math.abs(net).toFixed(0)} אין מינוס איבער די לעצטע 30 טעג — א שנעלער ציל איז צו קיצצן 5–10% אין די גרעסטע קאטעגאריע.`
      )
    } else {
      bullets.push(
        `איר האלטט בערך $${net.toFixed(0)} פארבליבן אין 30 טעג — האלט דעם ריטם און שטעלט א קלארן מאנאטליכן סאווינגס־ציל.`
      )
    }

    if (top) {
      bullets.push(
        `גרעסטע הוצאה־קאטעגאריע: ${top.name} (בערך $${Number(top.amount).toFixed(0)} / 30 טעג).`
      )
    } else {
      bullets.push('גרעסטע הוצאות: מיר זעען נישט גענוג קאטעגאריע־דאטן צו באשטימען א הויפט-סעקטאר.')
    }

    if (insurance > 0) {
      bullets.push(
        `אינשורענס־שאצונג לויט טראַנזאַקציעס: בערך $${insurance.toFixed(0)} / 30 טעג — א קאמפאריזאן קען אפט ברענגען 10–15% סאווינגס.`
      )
    } else {
      bullets.push('אינשורענס: אויב איר צאלט הויעך, פרעגט א פרישע ציטאט און פארגלייכט צוויי-דריי פראוויידערס.')
    }

    return bullets.slice(0, 3)
  }, [bankInsights, incomeMonthly, expensesMonthly])

  const incomeMonthlyEffective = useMemo(() => {
    // Prefer bank-derived income when available; otherwise fall back to manual input.
    return typeof bankInsights?.monthly_income === 'number' && bankInsights.monthly_income > 0
      ? bankInsights.monthly_income
      : incomeMonthly
  }, [bankInsights, incomeMonthly])

  const heimisheTotals = useMemo(() => {
    let weekly = 0
    let monthly = 0
    let yearly = 0

    for (const it of heimisheBudgetItems) {
      const row = heimisheBudget[it.key]
      if (!row) continue
      if (!row.source) continue
      const base = toNum(row[row.source])
      if (base === null) continue
      const computed = computeFrom(row.source, base)
      weekly += toNum(computed.weekly) ?? 0
      monthly += toNum(computed.monthly) ?? 0
      yearly += toNum(computed.yearly) ?? 0
    }

    return { weekly, monthly, yearly }
  }, [heimisheBudget, heimisheBudgetItems])

  const heimisheDropdownRows = useMemo(() => {
    return heimisheBudgetItems.map((it) => {
      const row = heimisheBudget[it.key] ?? { source: null, auto: false, weekly: '', monthly: '', yearly: '' }
      const base = row.source ? toNum((row as any)[row.source]) : null
      const computed = row.source && base !== null ? computeFrom(row.source, base) : null
      const weekly = toNum(computed?.weekly || '') ?? 0
      const monthly = toNum(computed?.monthly || '') ?? 0
      const yearly = toNum(computed?.yearly || '') ?? 0
      return { yi: it.yi, weekly: money2(weekly), monthly: money2(monthly), yearly: money2(yearly) }
    })
  }, [heimisheBudget, heimisheBudgetItems])

  function applySavingsToBudget(
    items: Array<{ target_budget_key?: string; category?: string; monthly_savings: number; title_yi: string }>
  ) {
    if (!Array.isArray(items) || items.length === 0) return

    const mapCategoryToKey = (category?: string | null) => {
      const c = String(category || '').toLowerCase()
      if (c.includes('insurance')) return ['healthInsurance', 'carInsurance', 'homeInsurance']
      if (c.includes('phone')) return ['phoneInternet', 'cellPhones']
      if (c.includes('internet')) return ['phoneInternet']
      if (c.includes('utilities')) return ['utilities']
      if (c.includes('subscription')) return ['subscriptions']
      return ['other']
    }

    setHeimisheBudget((prev) => {
      const next: Record<string, BudgetRow> = { ...prev }

      for (const it of items) {
        const savings = Math.max(0, Number(it.monthly_savings || 0))
        if (!savings) continue

        const candidates = it.target_budget_key
          ? [String(it.target_budget_key)]
          : mapCategoryToKey(it.category)

        const targetKey =
          candidates.find((k) => heimisheBudgetItems.some((x) => x.key === k)) ||
          candidates.find((k) => typeof next[k] !== 'undefined') ||
          null

        if (!targetKey) continue

        const existing = next[targetKey] ?? { source: null, auto: false, weekly: '', monthly: '', yearly: '' }

        // Convert current row to monthly baseline (best-effort)
        const baseSource = existing.source
        const baseRaw = baseSource ? existing[baseSource] : ''
        const baseNum = baseSource ? toNum(baseRaw) : null
        const monthlyNow =
          baseSource && baseNum !== null ? Number(computeFrom(baseSource, baseNum).monthly) : Number(existing.monthly || 0)

        const monthlyNext = Math.max(0, (Number.isFinite(monthlyNow) ? monthlyNow : 0) - savings)
        const computed = computeFrom('monthly', monthlyNext)

        next[targetKey] = {
          source: 'monthly',
          auto: true,
          weekly: computed.weekly,
          monthly: computed.monthly,
          yearly: computed.yearly,
        }
      }

      return next
    })
  }

  const logicContext = useMemo(() => {
    const items =
      heimisheBudgetItems?.map((it) => {
        const row = heimisheBudget[it.key] ?? { source: null, auto: false, weekly: '', monthly: '', yearly: '' }
        const base = row.source ? toNum(row[row.source]) : null
        const computed = row.source && base !== null ? computeFrom(row.source, base) : null
        const weekly = Number(computed?.weekly || 0) || 0
        const monthly = Number(computed?.monthly || 0) || 0
        const yearly = Number(computed?.yearly || 0) || 0
        return { key: it.key, yi: it.yi, weekly, monthly, yearly, auto: Boolean(row.auto) }
      }) || []

    const incomeM = typeof incomeMonthlyEffective === 'number' ? incomeMonthlyEffective : null
    const netM = incomeM !== null ? incomeM - (Number(heimisheTotals.monthly) || 0) : null

    return {
      totals: heimisheTotals,
      income_monthly: incomeM,
      net_monthly: netM,
      items,
      bank: bankInsights,
    }
  }, [bankInsights, heimisheBudget, heimisheBudgetItems, heimisheTotals, incomeMonthlyEffective])

  const downloadFinancialReportPdf = async () => {
    toast({
      title: copy.preparingPdfTitle,
      description: copy.preparingPdfDesc,
    })

    try {
      // Stamp the report right before capture (ensures accurate time in the PDF).
      setReportTimestamp(new Date().toLocaleString('he-IL'))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      // Ensure webfonts (Hebrew/Yiddish) are loaded before rasterizing.
      // This is important because html2canvas captures what the browser renders.
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready
      }

      const reportEl = document.getElementById('financial-report')
      if (!reportEl) {
        throw new Error('Missing report element')
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        pdf.addPage()
        position = heightLeft - imgHeight
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save('Unity-Credit-פינאנציעלער-רעפארט.pdf')
    } catch {
      toast({
        title: copy.pdfErrorTitle,
        description: copy.pdfErrorDesc,
        variant: 'destructive',
      })
    }
  }

  const handleBankSummary: NonNullable<ComponentProps<typeof BankConnectionPlaceholder>['onSummary']> = (summary) => {
    const parsed = bankSummarySchema.safeParse(summary)
    if (!parsed.success) {
      toast({
        title: 'Syncing…',
        description: 'באנק־דאַטן זענען געקומען אין א אומגילטיגן פארמאט. ביטע פרובירט נאכאמאל.',
        variant: 'destructive',
      })
      return
    }

    const s = parsed.data
    setExpensesMonthly(s.monthly_expenses)
    if (typeof s.monthly_income === 'number' && s.monthly_income > 0) setIncomeMonthly(s.monthly_income)
    setBankInsights(s)

    // Helpful default: if we can estimate insurance from transactions and user hasn't set it yet, prefill it.
    if (insuranceMonthly === 0 && typeof s.insurance_estimate === 'number' && s.insurance_estimate > 0) {
      setInsuranceMonthly(s.insurance_estimate)
    }

    // Auto-fill matching Heimishe Budget categories from bank transactions (best-effort).
    if (Array.isArray(s.heimishe_budget) && s.heimishe_budget.length > 0) {
      const byYiExact = new Map(heimisheBudgetItems.map((it) => [normText(it.yi), it.key]))

      const findTargetKey = (hb: { key?: string; yi?: string }) => {
        // 1) exact key match (default list uses stable keys)
        if (hb.key) {
          const k = String(hb.key)
          if (k) {
            const exact = heimisheBudgetItems.find((it) => it.key === k)?.key
            if (exact) return exact
          }
        }

        // 2) exact label match
        const yiNorm = normText(hb.yi || '')
        if (yiNorm) {
          const exact = byYiExact.get(yiNorm)
          if (exact) return exact
        }

        // 3) fuzzy label match (contains/starts-with) for common variants ("שבת" vs "הוצאות שבת ויום טוב", etc.)
        if (yiNorm) {
          const candidates = heimisheBudgetItems.map((it) => ({ key: it.key, yi: it.yi, n: normText(it.yi) }))
          const hit =
            candidates.find((c) => c.n && (c.n.includes(yiNorm) || yiNorm.includes(c.n))) ||
            // special: shabbos
            (yiNorm.includes('שבת') ? candidates.find((c) => c.n.includes('שבת')) : null) ||
            // special: tuition/schar limud
            (yiNorm.includes('לימוד') ? candidates.find((c) => c.n.includes('לימוד')) : null) ||
            // special: mikveh
            yiNorm.includes('מקוה') || yiNorm.includes('מיקוה')
              ? candidates.find((c) => c.n.includes('מקוה') || c.n.includes('מיקוה'))
              : null

          if (hit) return hit.key
        }

        return null
      }

      let applied = 0
      setHeimisheBudget((prev) => {
        const next: Record<string, BudgetRow> = { ...prev }

        for (const hb of s.heimishe_budget!) {
          const monthly = toFiniteNonNegativeNumber((hb as any)?.monthly_amount, 0)
          if (monthly <= 0) continue

          const targetKey = findTargetKey(hb as any)
          if (!targetKey) continue

          const existing = next[targetKey] ?? { source: null, auto: false, weekly: '', monthly: '', yearly: '' }

          // Only overwrite if this row was previously auto-filled OR is empty.
          const isEmpty = !existing.source && existing.weekly === '' && existing.monthly === '' && existing.yearly === ''
          const canOverwrite = Boolean(existing.auto) || isEmpty
          if (!canOverwrite) continue

          const computed = computeFrom('monthly', monthly)
          next[targetKey] = {
            source: 'monthly',
            auto: true,
            weekly: computed.weekly,
            monthly: computed.monthly,
            yearly: computed.yearly,
          }
          applied += 1
        }

        return next
      })

      if (applied > 0) {
        toast({
          title: 'היימישע בודזשעט — דערהיינטיקט',
          description: `${applied} קאטעגאריעס זענען אויטאמאטיש אריינגעלייגט פון באנק־טראַנזאַקציעס.`,
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gold/20 border-t-gold mx-auto mb-4"></div>
            <ShieldCheck className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gold" size={24} />
          </div>
          <p className="rtl-text text-xl text-white font-semibold">לייגט אן...</p>
        </div>
      </div>
    )
  }

  const firstName = String(user?.profile?.first_name || user?.user_metadata?.first_name || '').trim()
  const lastName = String(user?.profile?.last_name || user?.user_metadata?.last_name || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName = fullName

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-white to-[#f0f2f5]">
      <Navbar />
      {(bankSyncingUi || bankRefreshingUi) ? (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00BFFF]/20 border-t-[#00BFFF] mx-auto mb-4"></div>
            <div className="text-center">
              <div className="text-lg font-black text-primary">
                Unity Intelligence is syncing with your financial institution...
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {REQUIRE_BRAIN_APPROVAL_UI && brainHandshakeState === 'pending' && (
        <div className="bg-[#001f3f] text-white px-4 py-3">
          <div className="container mx-auto text-center font-semibold">
            {brainHandshakeMsg || 'System Syncing: Awaiting Administrator Approval'}
          </div>
        </div>
      )}

      {/* Hero Welcome Section */}
      <div className="bg-gradient-to-r from-[#001f3f] via-[#003d7a] to-[#001f3f] text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col items-center text-center gap-6">
            <UnityCreditBrandStack
              size="lg"
              label="UnityCredit"
              aria-label="UnityCredit"
              textClassName="text-4xl md:text-5xl font-black text-gold tracking-tight"
              className="select-none"
            />

            <div>
              <h1 className="text-4xl font-bold rtl-text mb-1">
                ברוכים הבאים{displayName ? ` ${displayName}` : ''}!
              </h1>
              <p className="text-white/80 rtl-text">
                דאָ איז אייער פֿינאַנציעלער קאָנטראָל־צענטער
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8 -mt-6">
        {process.env.NODE_ENV !== 'production' ? (
          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" className="h-10" onClick={runBrainTestSync}>
              Test Sync → Unity Brain
            </Button>
          </div>
        ) : null}

        {/* Hidden report surface for PDF generation (rendered offscreen, RTL-safe) */}
        <div
          id="financial-report"
          dir="rtl"
          className="fixed left-[-9999px] top-0 w-[794px] bg-white text-slate-900 p-8"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2">
                <UnityCreditBrandStack size="sm" label="UnityCredit" aria-label="UnityCredit" />
                {reportTimestamp && (
                  <div className="text-xs text-slate-500 rtl-text">
                    דאטע/צייט: {reportTimestamp}
                  </div>
                )}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-gold font-bold rtl-text">
              {copy.monthlySavingsPlan}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-[#003d7a] text-white p-4 border border-gold/20">
              <div className="text-sm text-white/80 rtl-text">{copy.utilizationNow}</div>
              <div className="text-2xl font-black text-gold">{utilization.toFixed(1)}%</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary to-[#003d7a] text-white p-4 border border-gold/20">
              <div className="text-sm text-white/80 rtl-text">{copy.utilizationGoal}</div>
              <div className="text-2xl font-black text-gold">30%</div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary to-[#003d7a] text-white p-4 border border-gold/20">
              <div className="text-sm text-white/80 rtl-text">{copy.payToGoal}</div>
              <div className="text-2xl font-black text-gold">
                ${payTo30.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Bank Balance vs Expenses (PDF KPI) */}
          {typeof bankInsights?.total_balance === 'number' ? (
          <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
                <div className="font-extrabold rtl-text text-right">סוף־סך־הכל</div>
                <div className="text-sm text-slate-600 rtl-text text-right">
                  באנק־באלאנס קעגן הוצאות (30 טעג)
              </div>
            </div>
              <div className="p-4 grid grid-cols-3 gap-3 bg-white">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
                  <div className="text-xs text-slate-600 rtl-text">באנק־באלאנס</div>
                  <div className={`text-lg font-black text-primary ${privacyMode ? 'blur-sm select-none' : ''}`}>
                    {privacyMode ? '***' : `$${Number(bankInsights.total_balance).toFixed(0)}`}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
                  <div className="text-xs text-slate-600 rtl-text">הוצאות / חודש</div>
                  <div className="text-lg font-black text-primary">${Number(bankInsights.monthly_expenses || 0).toFixed(0)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
                  <div className="text-xs text-slate-600 rtl-text">בלייבט נאך</div>
                  {(() => {
                    const bal = Number(bankInsights.total_balance || 0)
                    const exp = Number(bankInsights.monthly_expenses || 0)
                    const net = bal - exp
                    return (
                      <div className={`text-lg font-black ${net >= 0 ? 'text-[#00ff00]' : 'text-rose-700'}`}>
                        {privacyMode ? '***' : `$${net.toFixed(0)}`}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          ) : null}

      {/* Heimishe Budget (PDF) */}
      <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 p-4 border-b border-slate-200">
          <div className="font-extrabold rtl-text text-right">דער היימישער בודזשעט</div>
          <div className="text-sm text-slate-600 rtl-text text-right">
            סך־הכל: וועכנטליך <strong>${money2(heimisheTotals.weekly)}</strong> · חודש׳ליך{' '}
            <strong>${money2(heimisheTotals.monthly)}</strong> · יערליך <strong>${money2(heimisheTotals.yearly)}</strong>
          </div>
        </div>
        <div className="p-4 border-b border-slate-200 bg-white">
                <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
              <div className="text-xs text-slate-600 rtl-text">וועכנטליך</div>
              <div className="text-lg font-black text-primary">${money2(heimisheTotals.weekly)}</div>
                  </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
              <div className="text-xs text-slate-600 rtl-text">חודש׳ליך</div>
              <div className="text-lg font-black text-primary">${money2(heimisheTotals.monthly)}</div>
                  </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 rtl-text text-right">
              <div className="text-xs text-slate-600 rtl-text">יערליך</div>
              <div className="text-lg font-black text-primary">${money2(heimisheTotals.yearly)}</div>
                  </div>
                </div>
        </div>

        {/* Bank-derived grouping (PDF) */}
        {bankInsights?.heimishe_budget && bankInsights.heimishe_budget.length > 0 ? (
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="font-extrabold rtl-text text-right">לויט באנק־טראַנזאַקציעס (30 טעג)</div>
            <div className="text-xs text-slate-500 rtl-text text-right mt-1">
              די סומעס דאָ זענען געגרופֿט לויט היימישע קאַטעגאָריעס (לויט בעסטן מעגליכקייטן).
            </div>
            <div className="mt-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">קאַטעגאָריע</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">וועכנטליך</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">חודש׳ליך</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">יערליך</th>
                  </tr>
                </thead>
                <tbody>
                  {bankInsights.heimishe_budget.map((b) => {
                    const monthly = Number(b.monthly_amount) || 0
                    const c = computeFrom('monthly', monthly)
                    return (
                      <tr key={`${b.key}-${b.yi}`} className="border-t border-slate-200">
                        <td className="rtl-text text-right text-sm font-semibold text-slate-900 p-2">{b.yi}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">${c.weekly}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">${c.monthly}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">${c.yearly}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="p-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white">
                <th className="text-right rtl-text text-xs font-black text-slate-700 pb-2">הוצאה</th>
                <th className="text-right rtl-text text-xs font-black text-slate-700 pb-2">וועכנטליך</th>
                <th className="text-right rtl-text text-xs font-black text-slate-700 pb-2">חודש׳ליך</th>
                <th className="text-right rtl-text text-xs font-black text-slate-700 pb-2">יערליך</th>
              </tr>
            </thead>
            <tbody>
              {heimisheBudgetItems.map((it) => {
                const row = heimisheBudget[it.key] ?? { source: null, weekly: '', monthly: '', yearly: '' }
                const base = row.source ? toNum(row[row.source]) : null
                const computed = row.source && base !== null ? computeFrom(row.source, base) : null
                const weekly = toNum(computed?.weekly || '') ?? 0
                const monthly = toNum(computed?.monthly || '') ?? 0
                const yearly = toNum(computed?.yearly || '') ?? 0
                return (
                  <tr key={it.key} className="border-t border-slate-200">
                    <td className="rtl-text text-right text-sm font-semibold text-slate-900 py-2">{it.yi}</td>
                    <td className="rtl-text text-right text-sm text-slate-800 py-2">${money2(weekly)}</td>
                    <td className="rtl-text text-right text-sm text-slate-800 py-2">${money2(monthly)}</td>
                    <td className="rtl-text text-right text-sm text-slate-800 py-2">${money2(yearly)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <div className="font-extrabold rtl-text">{copy.highInterestWarnings}</div>
              <div className="text-sm text-slate-600 rtl-text">
                {highAprCards.length > 0 ? copy.aprWarning : 'קיינער נישט איבער 20% APR'}
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-2">
                {normalizedCards.map((c) => {
                  const interest = (c.balance * (c.aprPct / 100)) / 12
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div className="rtl-text">
                        <div className="font-bold text-primary">{c.name} **** {c.last4}</div>
                        <div className="text-xs text-slate-600 rtl-text">APR {c.aprPct.toFixed(1)}%</div>
                      </div>
                      <div className="text-left">
                        <div className="font-black text-primary">${c.balance.toFixed(2)}</div>
                        <div className="text-xs text-slate-600 rtl-text">אינטערעסט/חודש ${interest.toFixed(2)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <div className="font-extrabold rtl-text">{copy.insuranceComparison}</div>
              <div className="text-sm text-slate-600 rtl-text">{copy.insuranceSuggestion}</div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="rtl-text text-slate-700">
                {copy.insuranceInputLabel}: <span className="font-bold">${insuranceMonthly.toFixed(2)}</span>
              </div>
              <div className="rtl-text">
                <span className="text-slate-600">סאווינגס:</span>{' '}
                <span className="font-black text-[#00ff00]">${insuranceSavings.toFixed(2)}</span>
                <span className="text-slate-600"> / חודש</span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200">
              <div className="font-extrabold rtl-text">הוצאות קעגן הכנסות</div>
              <div className="text-sm text-slate-600 rtl-text">מאנאטליכע איבערבליק (לויט די איינגאבע)</div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between rtl-text">
                <span className="text-slate-600">הכנסה</span>
                <span className="font-black text-primary">${incomeMonthly.toFixed(0)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600"
                  style={{
                    width: `${Math.min(100, (incomeMonthly / Math.max(1, incomeMonthly, expensesMonthly)) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between rtl-text">
                <span className="text-slate-600">הוצאות</span>
                <span className="font-black text-primary">${expensesMonthly.toFixed(0)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-500"
                  style={{
                    width: `${Math.min(100, (expensesMonthly / Math.max(1, incomeMonthly, expensesMonthly)) * 100)}%`,
                  }}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 rtl-text flex items-center justify-between">
                <span className="text-slate-600">פארבליבן / סאווינגס</span>
                <span className={`font-black ${spendingSavings >= 0 ? 'text-[#00ff00]' : 'text-rose-700'}`}>
                  ${spendingSavings.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {bankInsights && (
            <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200">
                <div className="font-extrabold rtl-text">{copy.bankSavingsAdviceTitle}</div>
                <div className="text-sm text-slate-600 rtl-text">
                  {copy.bankSavingsAdviceDesc}
                  {bankInsights.last_updated ? (
                    <span className="font-semibold">
                      {' '}
                      ({copy.lastUpdated}: {new Date(bankInsights.last_updated).toLocaleString('he-IL')})
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="p-4 space-y-3">
                {bankInsights.top_spend_categories && bankInsights.top_spend_categories.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="font-semibold rtl-text text-primary mb-2">{copy.topSpendingCategories}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {bankInsights.top_spend_categories.slice(0, 5).map((c) => (
                        <div
                          key={c.name}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-[#f8fafc] p-3 rtl-text"
                        >
                          <span className="font-semibold text-primary">{c.name}</span>
                          <span className="font-black text-primary">${Number(c.amount).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bankBasedAdvice && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                    <div className="font-semibold rtl-text text-primary mb-2">קורצע רעקאמענדאציעס</div>
                    <ul className="list-disc pr-5 space-y-1 text-sm text-slate-700 rtl-text">
                      {bankBasedAdvice.map((b, i) => (
                        <li key={i} className="rtl-text">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500 rtl-text text-right">
            דער רעפארט איז א שאצונג אויף באזע פון די דאטן אין אייער אקאונט.
          </div>
          <div className="mt-2 text-xs text-slate-500 rtl-text text-right">{legalDisclaimerYI}</div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-primary to-[#003d7a] text-white border-0 shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium rtl-text opacity-90">
                גאנצער לימיט
              </CardTitle>
              <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-gold" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold mb-1">
                ${totalLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-white/70 rtl-text">
                טאָטאַל קרעדיט לימיט
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent to-[#0056b3] text-white border-0 shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium rtl-text opacity-90">
                גאנצער באלאנס
              </CardTitle>
              <div className="w-10 h-10 bg-gold/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-gold" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gold mb-1">
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      utilization > 80 ? 'bg-red-400' : utilization > 50 ? 'bg-gold' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-white/80 rtl-text">{utilization.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gold to-gold-dark text-primary border-0 shadow-xl hover:shadow-2xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium rtl-text opacity-90">
                פארבליבן
              </CardTitle>
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary mb-1">
                ${totalAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-primary/70 rtl-text">
                פארבליבענע קרעדיט
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Card Management (moved to immediately follow the 3 summary cards) */}
        <div className="space-y-6">
          <div className="rtl-text border-0 shadow-xl overflow-hidden rounded-2xl">
            <div className="h-1.5 w-full bg-[#001f3f]" />
            <div className="bg-[#001f3f] text-white px-4 py-7 flex items-center justify-center text-center">
              <div dir="ltr" className="text-2xl font-black tracking-tight">
                Credit Card
              </div>
            </div>
          </div>

          <CreditCardForm onSubmit={handleAddCard} />

          <div className="space-y-4">
            {cards.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-200">
                <CardContent className="pt-12 pb-12">
                  <div className="text-center">
                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground rtl-text font-medium">נאך קיין קארטלעך נישט צוגעלייגט</p>
                    <p className="text-sm text-muted-foreground rtl-text mt-2">לייגט צו אייער ערשטער קארטל אויבן</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              cards.map((card) => {
                const available = Math.max(0, toFiniteNonNegativeNumber(card.limit, 0) - toFiniteNonNegativeNumber(card.balance, 0))
                const cardUtilization =
                  card.limit > 0 ? Math.max(0, Math.min(100, (card.balance / card.limit) * 100)) : 0
                return (
                  <Card key={card.id} className="border-r-4 border-r-gold shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="rtl-text text-lg mb-1">{card.name}</CardTitle>
                          <p className="text-sm text-muted-foreground rtl-text">**** {card.last4}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCard(card.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rtl-text">
                          <p className="text-xs text-muted-foreground mb-1">לימיט</p>
                          <p className="font-semibold text-blue-700">
                            ${card.limit.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="rtl-text">
                          <p className="text-xs text-muted-foreground mb-1">באלאנס</p>
                          <p className="font-semibold text-rose-700">
                            ${card.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="rtl-text">
                          <p className="text-xs text-muted-foreground mb-1">פארבליבן</p>
                          <p className="font-semibold text-[#00ff00]">
                            ${available.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-2 rtl-text">
                          <span className="text-muted-foreground">אויטניצאציע</span>
                          <span className="font-semibold">{cardUtilization.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              cardUtilization > 80
                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                : cardUtilization > 50
                                ? 'bg-gradient-to-r from-gold to-gold-dark'
                                : 'bg-gradient-to-r from-green-500 to-green-600'
                            }`}
                            style={{ width: `${Math.min(cardUtilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* Pillar 1: Credit Hub (Free Tier) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-[#003d7a] rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <h2 className="text-2xl font-black text-primary rtl-text">Credit Hub</h2>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Self-Report Credit Score */}
          <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
            <div className="h-1.5 w-full bg-gradient-to-r from-gold to-gold-dark" />
            <CardHeader className="pb-4 rtl-text text-right">
              <CardTitle className="rtl-text text-xl text-primary">קרעדיט־סקאָר — אייגענע שאצונג</CardTitle>
              <p className="rtl-text text-sm text-muted-foreground">
                אריינלייגט אייער אייגענע שאצונג (300–850). {legalDisclaimerYI}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 rtl-text text-right">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-primary rtl-text">אייער שאצונג</div>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  type="number"
                  min={300}
                  max={850}
                  step={1}
                  value={selfReportedScore}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') {
                      setSelfReportedScore('')
                      return
                    }
                    const n = Math.round(Number(raw))
                    if (!Number.isFinite(n)) return
                    const clamped = Math.max(300, Math.min(850, n))
                    setSelfReportedScore(clamped)
                  }}
                  placeholder="למשל: 720"
                  className="h-11 border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between rtl-text">
                  <div>
                    <div className="font-black text-primary rtl-text">אינדיקאטאר</div>
                    <div className="text-xs text-muted-foreground rtl-text">300 – 850</div>
                  </div>
                  <div className="text-3xl font-black text-primary">
                    {typeof selfReportedScore === 'number' ? selfReportedScore : '—'}
                  </div>
                </div>
                <div className="mt-3 h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-rose-500 via-gold to-emerald-500"
                    style={{
                      width:
                        typeof selfReportedScore === 'number'
                          ? `${Math.max(0, Math.min(100, ((selfReportedScore - 300) / 550) * 100))}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between rtl-text">
                  <div>
                    <div className="font-black text-primary rtl-text">קרעדיט־סקאָר — שאצונג</div>
                    <div className="text-xs text-muted-foreground rtl-text">באזירט אויף utilization (קיין קרעדיט־רעפארט נישט)</div>
                  </div>
                  <div className="text-3xl font-black text-primary">{typeof creditScoreEstimate === 'number' ? creditScoreEstimate : '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance / privacy */}
          <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
            <div className="h-1.5 w-full bg-gradient-to-r from-gold to-gold-dark" />
            <CardHeader className="pb-4 rtl-text text-right">
              <CardTitle className="rtl-text text-xl text-primary">דיסקליימער</CardTitle>
              <p className="rtl-text text-sm text-muted-foreground">{legalDisclaimerYI}</p>
            </CardHeader>
            <CardContent className="space-y-3 rtl-text text-right">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-muted-foreground rtl-text">
                די קרעדיט־אויסטעלונגען דא זענען אינפארמאציע־באזירט. פאר א אפיציעלן קרעדיט־רעפארט, רעדט מיט א לייסענסד פראוויידער.
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 rtl-text">
                <div className="font-semibold text-primary rtl-text mb-2">קורצע עצות</div>
                <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground rtl-text">
                  <li className="rtl-text">האַלט אויטניצאציע נידעריג (ציל: אונטער 30%).</li>
                  <li className="rtl-text">צאל פונקטליך און פרוביר אויטא־צאלונג.</li>
                  <li className="rtl-text">מינימיזיר נייע קרעדיט־אינקווייריס.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>

        {/* Middle: Bank Connection + Transaction History (read-only until Pro) */}
        <ReadOnlyPaywall
          title="Read‑Only: Bank Connection"
          subtitle="Upgrade to use bank connection features. Tables remain visible, but controls are disabled."
          theme="blue"
          paywallPlacement="header-right"
          sectionTitle={'Bank Connection'}
        >
          <div className="space-y-6">
            <ErrorBoundary
              fallback={({ reset }) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 rtl-text text-right text-sm text-slate-700">
                  Banking section failed to load.{' '}
                  <button type="button" onClick={reset} className="underline font-semibold">
                    Retry
                  </button>
                </div>
              )}
            >
              <BankConnectionPlaceholder
                onSummary={handleBankSummary}
                onSyncingChange={setBankSyncingUi}
                onConnected={async () => {
                  try {
                    setBankRefreshingUi(true)
                    await fetchBankSummary()
                  } finally {
                    setBankRefreshingUi(false)
                  }
                }}
              />
            </ErrorBoundary>

            <ErrorBoundary
              fallback={({ reset }) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 rtl-text text-right text-sm text-slate-700">
                  Transaction history failed to load.{' '}
                  <button type="button" onClick={reset} className="underline font-semibold">
                    Retry
                  </button>
                </div>
              )}
            >
              <TransactionHistoryCard rows={bankInsights?.transactions_preview || []} privacyMode={privacyMode} />
            </ErrorBoundary>
            </div>
        </ReadOnlyPaywall>

        {/* Smart Savings (Savings Advice) — right after bank statements */}
        <ReadOnlyPaywall
          title="Read‑Only: Smart Savings"
          subtitle="Upgrade to use Smart Savings. Advice remains visible, but controls are disabled."
          theme="blue"
          paywallPlacement="header-right"
          sectionTitle={'Smart Savings'}
        >
          <div className="space-y-6">
            <SmartSavingsRealtime />
            <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
              <CardContent className="space-y-4 rtl-text text-right pt-6">
                <p className="rtl-text text-right text-sm text-muted-foreground">{copy.bankSavingsAdviceDesc}</p>
              {bankInsights?.top_spend_categories && bankInsights.top_spend_categories.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-primary rtl-text mb-2">{copy.topSpendingCategories}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {bankInsights.top_spend_categories.slice(0, 6).map((c) => (
                            <div
                              key={c.name}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-[#f8fafc] p-3 rtl-text text-right"
                            >
                              <span className="font-semibold text-primary">{c.name}</span>
                              <span className="font-black text-primary">${Number(c.amount).toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-muted-foreground rtl-text">
                  קאנעקט א באנק כדי צו זען סאווינגס עצה און טאפ קאטעגאריעס.
                </div>
              )}

              {bankBasedAdvice && bankBasedAdvice.length > 0 ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <div className="font-semibold text-primary rtl-text mb-2">קורצע רעקאמענדאציעס</div>
                  <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground rtl-text text-right">
                    {bankBasedAdvice.slice(0, 10).map((b, i) => (
                      <li key={i} className="rtl-text">
                        {b}
                      </li>
                        ))}
                      </ul>
                    </div>
              ) : null}
              </CardContent>
            </Card>

            <ErrorBoundary
              fallback={({ reset }) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 rtl-text text-right text-sm text-slate-700">
                  Unity Intelligence is currently optimizing your data...{' '}
                  <button type="button" onClick={reset} className="underline font-semibold">
                    Retry
                  </button>
                </div>
              )}
            >
              <AiAdviceBox brainState={brainHandshakeState} refreshKey={realtimeRefreshKey} />
            </ErrorBoundary>

            {/* Potential Savings (Unity Report summary) — bottom of Unity Intelligence area */}
            <ErrorBoundary
              fallback={({ reset }) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 rtl-text text-right text-sm text-slate-700">
                  Unity Intelligence insights are updating, but your bank data is 100% accurate and live.{' '}
                  <button type="button" onClick={reset} className="underline font-semibold">
                    Retry
                  </button>
                </div>
              )}
            >
              <MonthlySavingsSummary key={realtimeRefreshKey} />
            </ErrorBoundary>
          </div>
        </ReadOnlyPaywall>

        {/* Heimishe Expenses (searchable dropdown) */}
        <HeimisheExpensesDropdown title="היימישע עקספּענסעס" rows={heimisheDropdownRows} privacyMode={privacyMode} />

        {/* Final Module: Income vs. Expenses */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-black text-primary rtl-text">הוצאות קעגן הכנסות</h2>
          </div>
            <SpendingVsIncomeCard
              income={incomeMonthly}
              expenses={expensesMonthly}
              onIncomeChange={setIncomeMonthly}
              onExpensesChange={setExpensesMonthly}
            />
        </div>

        {/* Legal footer */}
        <div className="mt-10 pb-8 rtl-text text-right text-xs text-muted-foreground">
          {legalDisclaimerYI}
        </div>

        {/* Private Mode (moved to bottom) */}
        <div className="pb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="rtl-text text-right">
                <div className="font-black text-primary rtl-text">Private Mode</div>
                <div className="text-xs text-muted-foreground rtl-text">
                  ווען עס איז אָנגעשאַלטן, ווערן באַנק־באַלאַנסן געמאַסקירט אויף דער סקרין.
                </div>
              </div>
              <Button
                type="button"
                variant={privacyMode ? 'default' : 'outline'}
                onClick={() => setPrivacyMode((v) => !v)}
                className="h-10 font-semibold"
              >
                {privacyMode ? 'אָן' : 'אויס'}
              </Button>
            </div>
          </div>
        </div>

        <div className="pb-10 text-center text-xs text-slate-500">
          UnityCredit provides financial insights for informational purposes only and does not constitute official financial advice.
        </div>

        {/* (Existing deeper sections below) */}
      </div>
    </div>
  )
}
