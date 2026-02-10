'use client'

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Eye,
} from 'lucide-react'
import StatCard from '@/components/work/StatCard'
import RiskBadge from '@/components/work/RiskBadge'
import { useWorkMode } from '@/components/work/WorkModeContext'

const cashFlowSignals = [
  {
    id: 1,
    type: 'inflow' as const,
    title: 'Expected payment from Acme Corp',
    amount: '$12,500',
    date: 'Feb 12',
    confidence: 92,
    status: 'expected' as const,
  },
  {
    id: 2,
    type: 'outflow' as const,
    title: 'Software subscription renewals',
    amount: '$2,340',
    date: 'Feb 14',
    confidence: 100,
    status: 'confirmed' as const,
  },
  {
    id: 3,
    type: 'inflow' as const,
    title: 'Invoice #4523 — TechStart.io',
    amount: '$8,750',
    date: 'Feb 15',
    confidence: 65,
    status: 'uncertain' as const,
  },
  {
    id: 4,
    type: 'outflow' as const,
    title: 'Contractor payments — February',
    amount: '$6,200',
    date: 'Feb 18',
    confidence: 100,
    status: 'confirmed' as const,
  },
]

const invoiceReminders = [
  {
    id: 1,
    client: 'David Chen Consulting',
    invoiceId: '#INV-4892',
    amount: '$4,200',
    daysOverdue: 12,
    aiDraftReady: true,
  },
  {
    id: 2,
    client: 'GreenField Solutions',
    invoiceId: '#INV-4915',
    amount: '$7,800',
    daysOverdue: 5,
    aiDraftReady: true,
  },
  {
    id: 3,
    client: 'Pixel Perfect Design',
    invoiceId: '#INV-4920',
    amount: '$2,100',
    daysOverdue: 0,
    aiDraftReady: false,
  },
]

export default function MoneyAwarenessHub() {
  const { mode } = useWorkMode()

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Money Awareness Hub</h2>
        <p className="text-sm text-slate-400 mt-1">
          Cash flow signals and invoice reminders. AI prepares drafts — you approve.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Expected Inflow"
          value="$21,250"
          subtext="Next 7 days"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Expected Outflow"
          value="$8,540"
          subtext="Next 7 days"
          icon={<TrendingDown className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Overdue Invoices"
          value="$12,000"
          subtext="2 invoices pending"
          icon={<AlertCircle className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Net Cash Position"
          value="+$12,710"
          icon={<DollarSign className="w-5 h-5" />}
          trend={{ value: '8%', positive: true }}
          accent="blue"
        />
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cash Flow Signals */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Cash Flow Signals
          </h3>
          <div className="space-y-3">
            {cashFlowSignals.map((signal) => (
              <div
                key={signal.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {signal.type === 'inflow' ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    )}
                    <h4 className="text-sm font-medium text-white">{signal.title}</h4>
                  </div>
                  <span className={`text-sm font-bold ${signal.type === 'inflow' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {signal.type === 'outflow' && '-'}{signal.amount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500">{signal.date}</span>
                  </div>
                  <span className={`
                    text-[10px] px-2 py-0.5 rounded-full font-medium
                    ${signal.status === 'confirmed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : signal.status === 'expected'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }
                  `}>
                    {signal.status} • {signal.confidence}% conf.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Reminders */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            Invoice Reminders
          </h3>
          <div className="space-y-3">
            {invoiceReminders.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-white">{invoice.client}</h4>
                    <p className="text-[10px] text-slate-500">{invoice.invoiceId}</p>
                  </div>
                  <span className="text-sm font-bold text-white">{invoice.amount}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    {invoice.daysOverdue > 0 ? (
                      <RiskBadge
                        level={invoice.daysOverdue > 7 ? 'red' : 'yellow'}
                        label={`${invoice.daysOverdue}d overdue`}
                        size="sm"
                      />
                    ) : (
                      <RiskBadge level="green" label="Due today" size="sm" />
                    )}
                  </div>
                  {invoice.aiDraftReady ? (
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded-lg text-[10px] text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                      <button className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium transition-all flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Send Reminder
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">AI drafting...</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">AI Summary</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              You have <span className="text-red-400 font-medium">$12,000 in overdue invoices</span>.
              AI has prepared reminder drafts for 2 clients. One invoice is due today — no action needed yet.
              Suggested: Prioritize David Chen Consulting ({'>'}12 days overdue).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
