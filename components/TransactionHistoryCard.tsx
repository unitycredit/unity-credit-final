'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollText } from 'lucide-react'
import { toFiniteNumber } from '@/lib/finance/number'

export type TransactionPreviewRow = {
  date: string
  merchant: string
  name: string
  amount: number
  category: string
}

export default function TransactionHistoryCard(props: { rows: TransactionPreviewRow[]; privacyMode: boolean }) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const base = Array.isArray(props.rows) ? props.rows : []
    if (!query) return base.slice(0, 120)
    return base
      .filter((r) => `${r.merchant} ${r.name} ${r.category}`.toLowerCase().includes(query))
      .slice(0, 120)
  }, [props.rows, q])

  const money = (n: number) => (props.privacyMode ? '***' : `$${toFiniteNumber(n, 0).toFixed(2)}`)

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-700 to-slate-900" />
      <CardHeader className="pb-3 rtl-text text-right">
        <CardTitle className="rtl-text text-xl text-primary flex items-center gap-2 justify-end">
          <ScrollText className="h-5 w-5 text-slate-700" />
          אלע הוצאות פון באנק
        </CardTitle>
        <div className="mt-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="זוך… (merchant / category)"
            className="h-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length ? (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="rtl-text text-right w-[110px]">Date</TableHead>
                    <TableHead className="rtl-text text-right">Merchant</TableHead>
                    <TableHead className="rtl-text text-right">Category</TableHead>
                    <TableHead className="rtl-text text-right w-[120px]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, idx) => (
                    <TableRow key={`${r.date}-${r.merchant}-${idx}`}>
                      <TableCell className="rtl-text text-right text-slate-700">{String(r.date || '').slice(0, 10)}</TableCell>
                      <TableCell className="rtl-text text-right">
                        <div className="font-semibold text-primary rtl-text">{r.merchant || r.name || '—'}</div>
                        <div className="text-sm text-muted-foreground rtl-text">{r.name && r.name !== r.merchant ? r.name : ''}</div>
                      </TableCell>
                      <TableCell className="rtl-text text-right text-slate-700">{r.category || '—'}</TableCell>
                      <TableCell className="rtl-text text-right font-black text-slate-900">{money(r.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-base text-muted-foreground rtl-text text-right">
            קיין טראַנזאַקציעס בנימצא (נאך).
          </div>
        )}
      </CardContent>
    </Card>
  )
}


