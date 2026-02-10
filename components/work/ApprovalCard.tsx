'use client'

import { useState } from 'react'
import { Check, X, Eye } from 'lucide-react'

interface ApprovalCardProps {
  title: string
  description: string
  category: string
  aiConfidence: number
  preparedAt: string
  onApprove?: () => void
  onReject?: () => void
  onPreview?: () => void
}

export default function ApprovalCard({
  title,
  description,
  category,
  aiConfidence,
  preparedAt,
  onApprove,
  onReject,
  onPreview,
}: ApprovalCardProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const handleApprove = () => {
    setStatus('approved')
    onApprove?.()
  }

  const handleReject = () => {
    setStatus('rejected')
    onReject?.()
  }

  if (status !== 'pending') {
    return (
      <div className={`
        rounded-xl border p-4 transition-all duration-300
        ${status === 'approved'
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-red-500/10 border-red-500/30 opacity-60'
        }
      `}>
        <div className="flex items-center gap-2 text-sm">
          {status === 'approved' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <X className="w-4 h-4 text-red-400" />
          )}
          <span className={status === 'approved' ? 'text-emerald-400' : 'text-red-400'}>
            {title} — {status === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{category}</span>
          <h4 className="text-sm font-semibold text-white mt-0.5">{title}</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`
            w-2 h-2 rounded-full
            ${aiConfidence >= 90 ? 'bg-emerald-400' : aiConfidence >= 70 ? 'bg-amber-400' : 'bg-red-400'}
          `} />
          <span className="text-[10px] text-slate-400">{aiConfidence}%</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">{description}</p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{preparedAt}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReject}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Reject"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
