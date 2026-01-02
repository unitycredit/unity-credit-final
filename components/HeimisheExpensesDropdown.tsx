'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ChevronDown, Search } from 'lucide-react'

export type HeimisheExpenseRow = {
  yi: string
  weekly: string
  monthly: string
  yearly: string
}

export default function HeimisheExpensesDropdown(props: {
  title?: string
  rows: HeimisheExpenseRow[]
  privacyMode: boolean
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const base = Array.isArray(props.rows) ? props.rows : []
    if (!query) return base
    return base.filter((r) => String(r.yi || '').toLowerCase().includes(query))
  }, [props.rows, q])

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-600" />
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div
                className="shrink-0 rounded-xl border-2 border-[#0056b3]/40 bg-[#eaf3ff] p-1.5 text-[#0056b3] shadow-sm transition-all group-open:rotate-180 group-hover:border-[#0056b3] group-hover:bg-[#dcedff] group-hover:shadow-md select-none"
                aria-hidden="true"
              >
                <ChevronDown size={30} strokeWidth={3.75} />
              </div>
              <div className="rtl-text text-right">
                <CardTitle className="text-2xl md:text-3xl text-primary rtl-text text-right font-black">
                  {props.title || 'היימישע עקספּענסעס'}
                </CardTitle>
                <p className="text-base text-muted-foreground rtl-text text-right">
                  זוך און זע די פולע ליסטע (דריקט כדי צו עפֿענען/צוקלאַפּן).
                </p>
              </div>
            </div>
          </CardHeader>
        </summary>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="זוך…"
              className="h-11 pr-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500 rtl-text text-right"
              dir="rtl"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">הוצאה</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">וועכנטליך</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">חודש׳ליך</th>
                    <th className="text-right rtl-text text-xs font-black text-slate-700 p-2">יערליך</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length ? (
                    filtered.map((r, idx) => (
                      <tr key={`${r.yi}-${idx}`} className="border-t border-slate-200">
                        <td className="rtl-text text-right text-sm font-semibold text-slate-900 p-2">{r.yi}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">{props.privacyMode ? '***' : `$${r.weekly}`}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">{props.privacyMode ? '***' : `$${r.monthly}`}</td>
                        <td className="rtl-text text-right text-sm text-slate-800 p-2">{props.privacyMode ? '***' : `$${r.yearly}`}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-base text-muted-foreground rtl-text text-right">
                        קיין רעזולטאטן.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </details>
    </Card>
  )
}


