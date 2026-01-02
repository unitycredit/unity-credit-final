'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { useI18n } from '@/components/LanguageProvider'

type Category = {
  key: string
  yi: string
  en: string
}

/**
 * NOTE:
 * The workspace does not currently include the uploaded budget sheets/assets.
 * Update this list to exactly match EVERY line item from the sheets.
 */
const BASE_CATEGORIES: Category[] = [
  // Heimishe sheet examples (already in repo)
  { key: 'maaser', yi: 'מעשר', en: 'Maaser' },
  { key: 'tuition', yi: 'שכר לימוד', en: 'Tuition' },
  { key: 'mikveh', yi: 'מקוה געלט', en: 'Mikveh fees' },
  { key: 'kollel', yi: 'כולל / פּאָקעט־געלט', en: 'Kollel / Pocket money' },
  { key: 'shabbosYomtov', yi: "הוצאות שבת ויום טוב", en: 'Shabbos & Yom Tov' },
  { key: 'goyte', yi: 'גויטע (פסח/חודש)', en: 'Yom Tov (Pesach / monthly)' },
  { key: 'weddingsKids', yi: 'חתונה מאכן קינדער', en: 'Children weddings' },
  { key: 'tzedakah', yi: 'פארשידענע היימישע צדקה־הוצאות', en: 'Tzedakah (community/misc.)' },

  // Common household lines (often present on budget sheets)
  { key: 'rentMortgage', yi: 'דירה (רענט/מארטגעדזש)', en: 'Housing (rent/mortgage)' },
  { key: 'utilities', yi: 'יוטיליטיס (עלעקטריק/גאז/וואסער)', en: 'Utilities' },
  { key: 'phoneInternet', yi: 'טעלעפאן / אינטערנעט', en: 'Phone / Internet' },
  { key: 'groceries', yi: 'עסן (גראָסעריס)', en: 'Groceries' },
  { key: 'transport', yi: 'טראנספּאָרט (קאר/גאז/אויפהאלט)', en: 'Transportation' },
  { key: 'carInsurance', yi: 'קאר־אינשורענס', en: 'Car insurance' },
  { key: 'healthInsurance', yi: 'געזונט־אינשורענס', en: 'Health insurance' },
  { key: 'medical', yi: 'דאקטוירים / מעדיצינען', en: 'Medical' },
  { key: 'clothing', yi: 'קליידער', en: 'Clothing' },
  { key: 'campTuitionExtras', yi: 'קעמפּ / אפטער־סקול', en: 'Camp / after-school' },
  { key: 'gifts', yi: 'מתנות', en: 'Gifts' },
  { key: 'other', yi: 'אנדערע', en: 'Other' },
]

type Source = 'weekly' | 'monthly' | 'yearly' | null

type RowState = {
  source: Source
  weekly: string
  monthly: string
  yearly: string
}

const WEEKS_PER_MONTH = 4.33
const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

const CUSTOM_CATS_STORAGE_KEY = 'uc_budget_custom_categories_v1'

function toNum(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

function formatMoney(n: number) {
  // Keep cents for fidelity; user can type whole dollars.
  return n.toFixed(2)
}

function stableHash(input: string) {
  // Tiny deterministic hash for stable keys (non-cryptographic).
  // Produces a short base36 string; safe for client-side usage.
  let h = 5381
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i)
  return (h >>> 0).toString(36)
}

function slugKey(input: string) {
  // Make a stable-ish key from the label; fallback to timestamp.
  const base = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    // Keep this ES5-friendly for our TypeScript target: slug only ASCII, hash fallback for non-ASCII.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || `cat-${stableHash(input)}`
}

function computeFrom(source: Exclude<Source, null>, value: number) {
  if (source === 'weekly') {
    return {
      weekly: formatMoney(value),
      monthly: formatMoney(value * WEEKS_PER_MONTH),
      yearly: formatMoney(value * WEEKS_PER_YEAR),
    }
  }
  if (source === 'monthly') {
    return {
      weekly: formatMoney(value / WEEKS_PER_MONTH),
      monthly: formatMoney(value),
      yearly: formatMoney(value * MONTHS_PER_YEAR),
    }
  }
  return {
    weekly: formatMoney(value / WEEKS_PER_YEAR),
    monthly: formatMoney(value / MONTHS_PER_YEAR),
    yearly: formatMoney(value),
  }
}

export default function HeimisheSmartBudgetTable() {
  const { lang, dir, t } = useI18n()

  const [rows, setRows] = useState<Record<string, RowState>>(() => ({}))
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [importText, setImportText] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(CUSTOM_CATS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const safe = parsed
        .filter((x) => x && typeof x === 'object' && typeof x.key === 'string' && typeof x.yi === 'string')
        .map((x) => ({
          key: String((x as any).key),
          yi: String((x as any).yi),
          en: typeof (x as any).en === 'string' ? String((x as any).en) : String((x as any).yi),
        })) as Category[]
      setCustomCategories(safe)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(CUSTOM_CATS_STORAGE_KEY, JSON.stringify(customCategories))
    } catch {
      // ignore
    }
  }, [customCategories])

  const categories = useMemo(() => {
    const merged = [...BASE_CATEGORIES, ...customCategories]
    const seen = new Set<string>()
    const out: Array<Category & { isCustom: boolean }> = []
    for (const c of merged) {
      const key = c.key
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({ ...c, isCustom: customCategories.some((x) => x.key === key) })
    }
    return out
  }, [customCategories])

  const getLabel = (c: Category) => (lang === 'en' ? c.en || c.yi : c.yi)

  const updateRow = (key: string, next: RowState) => setRows((prev) => ({ ...prev, [key]: next }))

  const handleChange = (key: string, source: Exclude<Source, null>, raw: string) => {
    setRows((prev) => {
      const empty: RowState = { source: null, weekly: '', monthly: '', yearly: '' }
      if (raw === '') return { ...prev, [key]: empty }

      const n = toNum(raw)
      // Keep user input even if it's transiently invalid.
      if (n === null) {
        const prior = prev[key] ?? empty
        return { ...prev, [key]: { ...prior, source, [source]: raw } as RowState }
      }

      // Store ONLY the user's chosen column; keep others blank (but display computed placeholders).
      const normalized = formatMoney(n)
      const next: RowState =
        source === 'weekly'
          ? { source, weekly: normalized, monthly: '', yearly: '' }
          : source === 'monthly'
          ? { source, weekly: '', monthly: normalized, yearly: '' }
          : { source, weekly: '', monthly: '', yearly: normalized }

      return { ...prev, [key]: next }
    })
  }

  const handleFocusSwitch = (key: string, nextSource: Exclude<Source, null>) => {
    setRows((prev) => {
      const row = prev[key]
      if (!row?.source || row.source === nextSource) return prev

      const baseRaw = row[row.source]
      const base = toNum(baseRaw)
      if (base === null) return prev

      const computed = computeFrom(row.source, base)
      const nextValue = computed[nextSource]

      const next: RowState =
        nextSource === 'weekly'
          ? { source: 'weekly', weekly: nextValue, monthly: '', yearly: '' }
          : nextSource === 'monthly'
          ? { source: 'monthly', weekly: '', monthly: nextValue, yearly: '' }
          : { source: 'yearly', weekly: '', monthly: '', yearly: nextValue }

      return { ...prev, [key]: next }
    })
  }

  const totals = useMemo(() => {
    let weekly = 0
    let monthly = 0
    let yearly = 0
    for (const c of categories) {
      const r = rows[c.key]
      if (!r?.source) continue
      const base = toNum(r[r.source])
      if (base === null) continue
      const computed = computeFrom(r.source, base)
      weekly += toNum(computed.weekly) ?? 0
      monthly += toNum(computed.monthly) ?? 0
      yearly += toNum(computed.yearly) ?? 0
    }
    return { weekly, monthly, yearly }
  }, [rows, categories])

  const addCustomCategory = (name: string) => {
    const yi = name.trim()
    if (!yi) return
    const baseKey = slugKey(yi)
    let key = baseKey
    let i = 2
    while (
      BASE_CATEGORIES.some((c) => c.key === key) ||
      customCategories.some((c) => c.key === key)
    ) {
      key = `${baseKey}-${i}`
      i += 1
    }
    setCustomCategories((prev) => [...prev, { key, yi, en: yi }])
  }

  const importCategories = () => {
    const lines = importText
      .split(/\r?\n/g)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    for (const line of lines) addCustomCategory(line)
    setImportText('')
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-600" />
      <CardHeader className="pb-4">
        <CardTitle className="rtl-text text-xl text-primary text-right">{t('heimisheSmart.title')}</CardTitle>
        <p className="rtl-text text-sm text-muted-foreground text-right">{t('heimisheSmart.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4 rtl-text text-right">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="rtl-text text-right text-sm font-semibold text-primary">
              {t('heimisheSmart.addCategory')}
            </div>
            <div className="mt-2 flex gap-2 items-center justify-end">
              <Input
                dir={dir}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('heimisheSmart.addCategory.placeholder')}
                className="h-10 text-right border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <Button
                type="button"
                onClick={() => {
                  addCustomCategory(newCategoryName)
                  setNewCategoryName('')
                }}
                className="h-10 bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('heimisheSmart.add')}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="rtl-text text-right text-sm font-semibold text-primary">
              {t('heimisheSmart.import')}
            </div>
            <div className="mt-2 space-y-2">
              <textarea
                dir={dir}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={t('heimisheSmart.import.placeholder')}
                className="w-full min-h-[90px] rounded-md border-2 border-gray-200 bg-white p-3 text-right focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              />
              <div className="flex justify-end">
                <Button type="button" onClick={importCategories} className="h-10 bg-primary text-primary-foreground">
                  {t('heimisheSmart.import.apply')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="rtl-text text-right w-[34%]">{t('heimisheSmart.category')}</TableHead>
                <TableHead className="rtl-text text-right">{t('heimisheSmart.weekly')}</TableHead>
                <TableHead className="rtl-text text-right">{t('heimisheSmart.monthly')}</TableHead>
                <TableHead className="rtl-text text-right">{t('heimisheSmart.yearly')}</TableHead>
                <TableHead className="rtl-text text-right w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => {
                const r = rows[c.key] ?? { source: null, weekly: '', monthly: '', yearly: '' }
                const label = getLabel(c)
                const weeklyReadOnly = Boolean(r.source && r.source !== 'weekly')
                const monthlyReadOnly = Boolean(r.source && r.source !== 'monthly')
                const yearlyReadOnly = Boolean(r.source && r.source !== 'yearly')

                const base = r.source ? toNum(r[r.source]) : null
                const computed = r.source && base !== null ? computeFrom(r.source, base) : null

                const commonInputClass =
                  'h-10 w-36 text-right border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20'
                const roClass = 'bg-slate-50 text-slate-700'

                return (
                  <TableRow key={c.key}>
                    <TableCell className="rtl-text text-right font-semibold text-primary">{label}</TableCell>

                    <TableCell className="rtl-text text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          dir={dir}
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step={1}
                          value={r.weekly}
                          placeholder={weeklyReadOnly ? computed?.weekly : ''}
                          readOnly={weeklyReadOnly}
                          onFocus={() => handleFocusSwitch(c.key, 'weekly')}
                          onChange={(e) => handleChange(c.key, 'weekly', e.target.value)}
                          className={`${commonInputClass} ${weeklyReadOnly ? roClass : ''}`}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="rtl-text text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          dir={dir}
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step={1}
                          value={r.monthly}
                          placeholder={monthlyReadOnly ? computed?.monthly : ''}
                          readOnly={monthlyReadOnly}
                          onFocus={() => handleFocusSwitch(c.key, 'monthly')}
                          onChange={(e) => handleChange(c.key, 'monthly', e.target.value)}
                          className={`${commonInputClass} ${monthlyReadOnly ? roClass : ''}`}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="rtl-text text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          dir={dir}
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step={1}
                          value={r.yearly}
                          placeholder={yearlyReadOnly ? computed?.yearly : ''}
                          readOnly={yearlyReadOnly}
                          onFocus={() => handleFocusSwitch(c.key, 'yearly')}
                          onChange={(e) => handleChange(c.key, 'yearly', e.target.value)}
                          className={`${commonInputClass} ${yearlyReadOnly ? roClass : ''}`}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="rtl-text text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-slate-500 hover:text-slate-900"
                        onClick={() => updateRow(c.key, { source: null, weekly: '', monthly: '', yearly: '' })}
                        aria-label={t('heimisheSmart.clearRow')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}

              <TableRow>
                <TableCell className="rtl-text text-right font-black text-primary">{t('heimisheSmart.total')}</TableCell>
                <TableCell className="rtl-text text-right font-bold text-primary">${totals.weekly.toFixed(2)}</TableCell>
                <TableCell className="rtl-text text-right font-bold text-primary">${totals.monthly.toFixed(2)}</TableCell>
                <TableCell className="rtl-text text-right font-bold text-primary">${totals.yearly.toFixed(2)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground rtl-text text-right">
          {t('heimisheSmart.noteFactors')}
        </div>
      </CardContent>
    </Card>
  )
}


