'use client'

import {
  BarChart3,
  Clock,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Zap,
  Target,
  Brain,
  CheckCircle2,
} from 'lucide-react'
import StatCard from '@/components/work/StatCard'
import RiskBadge from '@/components/work/RiskBadge'

const timeLeaks = [
  {
    id: 1,
    title: 'Context switching between tools',
    hoursLost: '3.2 hrs/week',
    severity: 'high' as const,
    suggestion: 'Consolidate communication into morning and afternoon blocks',
  },
  {
    id: 2,
    title: 'Unscheduled meetings',
    hoursLost: '2.1 hrs/week',
    severity: 'medium' as const,
    suggestion: 'Set "no meeting" blocks on Tuesday and Thursday mornings',
  },
  {
    id: 3,
    title: 'Email re-checking patterns',
    hoursLost: '1.5 hrs/week',
    severity: 'low' as const,
    suggestion: 'Use AI-prepared email batches — check 3x daily instead of 15x',
  },
]

const riskAlerts = [
  {
    id: 1,
    title: 'Q2 Hiring Plan — deadline approaching',
    description: 'Only 45% complete with 3 days remaining. Suggest blocking 2 hours tomorrow for focused work.',
    level: 'red' as const,
    category: 'Deadline',
  },
  {
    id: 2,
    title: 'Client communication gap — Acme Corp',
    description: 'No response in 5 days. AI recommends a check-in call.',
    level: 'yellow' as const,
    category: 'Communication',
  },
  {
    id: 3,
    title: 'Invoice collection slowing',
    description: 'Average collection time increased from 18 to 27 days this month.',
    level: 'yellow' as const,
    category: 'Money',
  },
]

const fixNext = [
  {
    id: 1,
    title: 'Block 2 hours for Q2 Hiring Plan',
    impact: 'High',
    effort: '5 min to schedule',
    icon: Target,
  },
  {
    id: 2,
    title: 'Send overdue invoice reminders',
    impact: 'High',
    effort: 'AI drafts ready — 1 click',
    icon: Zap,
  },
  {
    id: 3,
    title: 'Batch email processing',
    impact: 'Medium',
    effort: 'Enable in settings',
    icon: Brain,
  },
]

export default function InsightsHub() {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Insights Hub</h2>
        <p className="text-sm text-slate-400 mt-1">
          AI-powered insights on time leaks, risk alerts, and clear guidance on what to fix next.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Time Leaks Found"
          value="6.8 hrs"
          subtext="Potential weekly savings"
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Active Risks"
          value="3"
          subtext="1 critical, 2 moderate"
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Efficiency Score"
          value="78/100"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: '5pts', positive: true }}
          accent="indigo"
        />
        <StatCard
          label="Suggestions Applied"
          value="12"
          subtext="This month"
          icon={<Lightbulb className="w-5 h-5" />}
          accent="emerald"
        />
      </div>

      {/* Three sections */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Time Leaks */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Time Leaks
          </h3>
          <div className="space-y-3">
            {timeLeaks.map((leak) => (
              <div
                key={leak.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-white">{leak.title}</h4>
                  <span className={`
                    text-[10px] font-bold
                    ${leak.severity === 'high' ? 'text-red-400' : leak.severity === 'medium' ? 'text-amber-400' : 'text-slate-400'}
                  `}>
                    -{leak.hoursLost}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-900/60 border border-slate-700/30 p-2.5 mt-2">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-400 leading-relaxed">{leak.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Risk Alerts
          </h3>
          <div className="space-y-3">
            {riskAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`
                  rounded-xl border p-4
                  ${alert.level === 'red'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-slate-700/50 bg-slate-800/40'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{alert.category}</span>
                  <RiskBadge level={alert.level} size="sm" />
                </div>
                <h4 className="text-sm font-medium text-white mt-1">{alert.title}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What to Fix Next */}
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            What to Fix Next
          </h3>
          <div className="space-y-3">
            {fixNext.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">{item.title}</h4>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-emerald-400">Impact: {item.impact}</span>
                        <span className="text-[10px] text-slate-500">{item.effort}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* AI recommendation */}
          <div className="mt-4 rounded-xl bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border border-blue-500/20 p-4">
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-blue-300">AI Recommendation</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Based on your current workload patterns, the highest-impact action is blocking 2 hours
                  for the Q2 Hiring Plan. This resolves your biggest deadline risk and frees mental bandwidth
                  for the rest of the week.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
