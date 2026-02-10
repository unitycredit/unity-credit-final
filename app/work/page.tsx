'use client'

import { Clock, CheckCircle2, TrendingUp, Zap, ArrowRight, MessageSquare, CalendarDays, DollarSign, BarChart3 } from 'lucide-react'
import StatCard from '@/components/work/StatCard'
import ApprovalCard from '@/components/work/ApprovalCard'
import RiskBadge from '@/components/work/RiskBadge'
import { useWorkMode } from '@/components/work/WorkModeContext'
import Link from 'next/link'

// Demo data for the home screen
const todaysFocus = [
  { id: 1, title: 'Follow up with 3 pending client emails', priority: 'high' as const, hub: 'Communication' },
  { id: 2, title: 'Finalize weekly project plan', priority: 'medium' as const, hub: 'Work Planning' },
  { id: 3, title: 'Review 2 overdue invoices', priority: 'high' as const, hub: 'Money Awareness' },
]

const pendingApprovals = [
  {
    title: 'Follow-up Email to Acme Corp',
    description: 'AI drafted a professional follow-up regarding the Q1 proposal. Includes updated pricing and next steps.',
    category: 'Communication',
    aiConfidence: 94,
    preparedAt: '2 min ago',
  },
  {
    title: 'Weekly Work Brief',
    description: 'Summary of this week\'s completed tasks, blockers, and recommended priorities for next week.',
    category: 'Work Planning',
    aiConfidence: 97,
    preparedAt: '15 min ago',
  },
  {
    title: 'Invoice Reminder — Client #4892',
    description: 'Payment overdue by 12 days. AI prepared a polite reminder draft with payment link.',
    category: 'Money',
    aiConfidence: 88,
    preparedAt: '1 hr ago',
  },
]

const priorityColors = {
  high: 'text-red-400 bg-red-500/10 border-red-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

export default function WorkHomePage() {
  const { mode } = useWorkMode()

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-violet-600/10 border border-blue-500/20 p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">Good morning</h2>
            <p className="text-sm text-slate-300 mt-1">
              AI prepared <span className="text-blue-400 font-semibold">{pendingApprovals.length} actions</span> for your review.
              {mode === 'autopilot' && ' Autopilot handled 5 routine tasks overnight.'}
            </p>
          </div>
          <Link
            href="#approve-center"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/25"
          >
            Review & Approve
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Time Saved This Week"
          value="4.2 hrs"
          subtext="vs. 3.1 hrs last week"
          icon={<Clock className="w-5 h-5" />}
          trend={{ value: '35%', positive: true }}
          accent="blue"
        />
        <StatCard
          label="Actions Approved"
          value="18"
          subtext="3 pending review"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Productivity Score"
          value="92"
          subtext="Top 10% this month"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: '8pts', positive: true }}
          accent="indigo"
        />
        <StatCard
          label="AI Tasks Running"
          value={mode === 'autopilot' ? '7' : '3'}
          subtext={mode === 'autopilot' ? 'Autopilot active' : 'Co-Pilot mode'}
          icon={<Zap className="w-5 h-5" />}
          accent="violet"
        />
      </div>

      {/* Two-column layout: Focus + Risk */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Focus */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Today&apos;s Focus</h3>
            <span className="text-xs text-slate-500">Max 3 items</span>
          </div>
          <div className="space-y-3">
            {todaysFocus.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all group"
              >
                <div className={`
                  w-2 h-2 rounded-full flex-shrink-0
                  ${item.priority === 'high' ? 'bg-red-400' : item.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}
                `} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{item.title}</h4>
                  <span className={`
                    inline-flex items-center mt-1 text-[10px] px-2 py-0.5 rounded-full border font-medium
                    ${priorityColors[item.priority]}
                  `}>
                    {item.priority}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{item.hub}</span>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Risk Status */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Risk Status</h3>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Overall</span>
              <RiskBadge level="yellow" />
            </div>
            <div className="space-y-3 pt-2 border-t border-slate-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Communication</span>
                <RiskBadge level="yellow" label="3 overdue" size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Work Planning</span>
                <RiskBadge level="green" label="On track" size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Money</span>
                <RiskBadge level="red" label="2 overdue" size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Insights</span>
                <RiskBadge level="green" label="All clear" size="sm" />
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Access</h4>
            {[
              { href: '/work/communication', icon: MessageSquare, label: 'Communication' },
              { href: '/work/planning', icon: CalendarDays, label: 'Work Planning' },
              { href: '/work/money', icon: DollarSign, label: 'Money' },
              { href: '/work/insights', icon: BarChart3, label: 'Insights' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Approve Center */}
      <div id="approve-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Prepared Actions — Approve Center</h3>
          <span className="text-xs text-slate-500">{pendingApprovals.length} awaiting review</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingApprovals.map((item, i) => (
            <ApprovalCard key={i} {...item} />
          ))}
        </div>
      </div>

      {/* Mode indicator footer */}
      <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`
            w-2 h-2 rounded-full animate-pulse
            ${mode === 'advisor' ? 'bg-amber-400' : mode === 'copilot' ? 'bg-blue-400' : 'bg-emerald-400'}
          `} />
          <span className="text-xs text-slate-400">
            {mode === 'advisor' && 'Advisor Mode — AI is analyzing your work and providing insights'}
            {mode === 'copilot' && 'Co-Pilot Mode — AI prepares actions for your approval'}
            {mode === 'autopilot' && 'Autopilot Mode — AI handles routine tasks within defined rules'}
          </span>
        </div>
        <span className="text-[10px] text-slate-600">Don&apos;t change your tools. Change who runs them.</span>
      </div>
    </div>
  )
}
