'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

export type HeimisheCategorySummary = {
  label: string
  monthly: number
}

export default function HeimisheExpensesAccordion(props: {
  totalMonthly: number
  categories: HeimisheCategorySummary[]
  privacyMode: boolean
  onDownloadPdf?: () => void
}) {
  const [selected, setSelected] = useState<string>('__total__')

  const categories = useMemo(() => {
    const cats = Array.isArray(props.categories) ? props.categories : []
    const sorted = cats
      .filter((c) => Number.isFinite(c.monthly) && c.monthly > 0)
      .sort((a, b) => b.monthly - a.monthly)
    return sorted
  }, [props.categories])

  const money = (n: number) => (props.privacyMode ? '***' : `$${n.toFixed(0)}`)

  const selectedMonthly = useMemo(() => {
    if (selected === '__total__') return props.totalMonthly
    const hit = categories.find((c) => c.label === selected)
    return hit?.monthly ?? 0
  }, [selected, props.totalMonthly, categories])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="rtl-text text-right">
          <div className="text-xs text-slate-600 rtl-text">סך־הכל / חודש</div>
          <div className="text-xl font-black text-primary">{money(props.totalMonthly)}</div>
        </div>
        {props.onDownloadPdf ? (
          <Button type="button" onClick={props.onDownloadPdf} variant="outline" className="h-9">
            Download PDF
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 rtl-text text-right">
        <div className="text-sm font-semibold text-primary rtl-text">קאַטעגאָריע</div>
        <select
          dir="rtl"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[#1a1a1a]"
        >
          <option value="__total__">סך־הכל</option>
          {categories.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700 rtl-text">
            {selected === '__total__' ? 'סך־הכל' : selected}
          </div>
          <div className="text-sm font-black text-primary">{money(selectedMonthly)}</div>
        </div>
      </div>
    </div>
  )
}


