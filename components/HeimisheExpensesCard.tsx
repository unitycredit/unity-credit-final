'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useI18n } from '@/components/LanguageProvider'

type Category = {
  key: string
  yi: string
  en: string
}

const categories: Category[] = [
  { key: 'tuition', yi: 'שכר לימוד', en: 'Tuition' },
  { key: 'mikveh', yi: 'מקוה געלט', en: 'Mikveh fees' },
  { key: 'kollel', yi: 'כולל / פּאָקעט־געלט', en: 'Kollel / Pocket money' },
  { key: 'shabbos', yi: 'הוצאות שבת ויום טוב', en: 'Shabbos & Yom Tov expenses' },
  { key: 'weddings', yi: 'חתונה מאכן קינדער', en: 'Children weddings' },
  { key: 'yomTov', yi: 'גויטע (פסח/חודש)', en: 'Yom Tov (Pesach / monthly)' },
  { key: 'tzedakah', yi: 'פארשידענע היימישע צדקה־הוצאות', en: 'Community tzedakah & misc.' },
]

export default function HeimisheExpensesCard() {
  const { lang, dir, t } = useI18n()
  const [values, setValues] = useState<Record<string, number>>({})

  const total = useMemo(() => {
    return Object.values(values).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0)
  }, [values])

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-600" />
      <CardHeader className="pb-4">
        <CardTitle className="rtl-text text-xl text-primary text-right">{t('heimishe.title')}</CardTitle>
        <p className="rtl-text text-sm text-muted-foreground text-right">{t('heimishe.desc')}</p>
      </CardHeader>
      <CardContent className="space-y-4 rtl-text text-right">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="rtl-text text-right w-[60%]">{t('heimishe.category')}</TableHead>
                <TableHead className="rtl-text text-right">{t('heimishe.monthly')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => {
                const label = lang === 'en' ? c.en : c.yi
                const v = values[c.key] ?? 0
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
                          step={10}
                          value={Number.isFinite(v) ? v : 0}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0)
                            setValues((prev) => ({ ...prev, [c.key]: next }))
                          }}
                          className="h-10 w-44 text-right border-2 border-gray-200 focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-[#f8fafc] p-4 flex items-center justify-between">
          <span className="rtl-text text-sm text-muted-foreground">{t('heimishe.total')}</span>
          <span className="font-black text-primary">${total.toFixed(0)}</span>
        </div>
      </CardContent>
    </Card>
  )
}


