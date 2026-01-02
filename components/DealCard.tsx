'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type DealCardData = {
  store: string
  title: string
  url: string
  original_price?: number | null
  sale_price?: number | null
  savings_amount?: number | null
  discount_pct?: number | null
  price_crash?: boolean
  subtitle?: string | null
}

function fmtUsd(n: any) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${v.toFixed(2)}`
}

export default function DealCard(props: { data: DealCardData; onOpen?: () => void }) {
  const d = props.data
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-primary truncate">
            {d.store}
            {typeof d.discount_pct === 'number' ? <span className="text-slate-500 font-semibold"> · {d.discount_pct}%+</span> : null}
            {d.price_crash ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-black">
                Price Crash
              </span>
            ) : null}
          </div>
          <div className="text-sm text-slate-800 mt-1">{d.title}</div>
          {d.subtitle ? <div className="text-xs text-slate-600 mt-1">{d.subtitle}</div> : null}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Original</div>
              <div className="text-lg font-black text-primary">{fmtUsd(d.original_price)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Sale</div>
              <div className="text-lg font-black text-primary">{fmtUsd(d.sale_price)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-600">Savings</div>
              <div className="text-lg font-black text-[#00ff00]">{fmtUsd(d.savings_amount)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <Button
            type="button"
            className="h-10 font-semibold"
            onClick={() => {
              props.onOpen?.()
              window.open(d.url, '_blank', 'noreferrer')
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Buy now
          </Button>
        </div>
      </div>
    </div>
  )
}


