'use client'

import {
  MessageSquare,
  CalendarDays,
  FileText,
  AlertTriangle,
  Users,
  Workflow,
  Mail,
  Brain,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useWorkMode } from '@/components/work/WorkModeContext'

const services = [
  {
    id: 'smart-followups',
    title: 'Smart Follow-ups',
    description: 'AI tracks conversations and drafts follow-up messages when responses are overdue.',
    icon: MessageSquare,
    status: 'active' as const,
    actionsThisWeek: 12,
    category: 'Communication',
    color: 'blue',
  },
  {
    id: 'daily-plan-builder',
    title: 'Daily Plan Builder',
    description: 'AI analyzes your priorities, meetings, and deadlines to build an optimal daily schedule.',
    icon: CalendarDays,
    status: 'active' as const,
    actionsThisWeek: 5,
    category: 'Planning',
    color: 'indigo',
  },
  {
    id: 'weekly-work-brief',
    title: 'Weekly Work Brief',
    description: 'End-of-week summary of completed work, pending items, and recommended priorities.',
    icon: FileText,
    status: 'active' as const,
    actionsThisWeek: 1,
    category: 'Planning',
    color: 'violet',
  },
  {
    id: 'meeting-prep',
    title: 'Meeting Prep',
    description: 'AI prepares context, agenda items, and talking points before each meeting.',
    icon: Users,
    status: 'active' as const,
    actionsThisWeek: 8,
    category: 'Communication',
    color: 'emerald',
  },
  {
    id: 'invoice-reminders',
    title: 'Invoice Reminder Drafts',
    description: 'Automatic detection of overdue invoices with AI-drafted polite reminder messages.',
    icon: Mail,
    status: 'active' as const,
    actionsThisWeek: 3,
    category: 'Money',
    color: 'amber',
  },
  {
    id: 'risk-alerts',
    title: 'Risk Alerts',
    description: 'Proactive detection of deadline risks, communication gaps, and cash flow issues.',
    icon: AlertTriangle,
    status: 'active' as const,
    actionsThisWeek: 4,
    category: 'Insights',
    color: 'red',
  },
  {
    id: 'customer-memory',
    title: 'Customer Memory',
    description: 'AI remembers client preferences, past interactions, and important context for every contact.',
    icon: Brain,
    status: 'active' as const,
    actionsThisWeek: 15,
    category: 'Communication',
    color: 'blue',
  },
  {
    id: 'process-builder',
    title: 'Simple Process Builder',
    description: 'Define repeatable workflows. AI executes steps and asks for approval at key moments.',
    icon: Workflow,
    status: 'beta' as const,
    actionsThisWeek: 2,
    category: 'Automation',
    color: 'indigo',
  },
]

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
}

export default function AIServicesPage() {
  const { mode } = useWorkMode()

  const totalActions = services.reduce((sum, s) => sum + s.actionsThisWeek, 0)

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">AI Services</h2>
          <p className="text-sm text-slate-400 mt-1">
            {services.length} focused AI services working independently or together.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">{services.filter((s) => s.status === 'active').length} Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-400 font-medium">{totalActions} actions this week</span>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {services.map((service) => {
          const Icon = service.icon
          const colors = colorMap[service.color]
          return (
            <div
              key={service.id}
              className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 hover:border-blue-500/30 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${colors.bg} ${colors.text} flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white">{service.title}</h3>
                    {service.status === 'beta' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 font-semibold uppercase">
                        Beta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{service.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.actionsThisWeek} actions this week
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border} font-medium`}>
                        {service.category}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* How it works */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600/10 via-indigo-600/8 to-violet-600/5 border border-blue-500/20 p-6">
        <h3 className="text-sm font-bold text-white mb-3">How AI Services Work</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">AI Prepares</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Services analyze your work and prepare actions automatically.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">You Review</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Preview every action. Edit if needed. Nothing happens without you.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Execute</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Approve and it&apos;s done. Or let Autopilot handle routine tasks.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode info */}
      <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 flex items-center gap-3">
        <div className={`
          w-2 h-2 rounded-full
          ${mode === 'advisor' ? 'bg-amber-400' : mode === 'copilot' ? 'bg-blue-400' : 'bg-emerald-400'}
        `} />
        <p className="text-xs text-slate-400">
          {mode === 'advisor' && 'In Advisor mode, services provide insights only — no actions are prepared.'}
          {mode === 'copilot' && 'In Co-Pilot mode, services prepare actions for your approval.'}
          {mode === 'autopilot' && 'In Autopilot mode, routine actions are executed automatically within your defined rules.'}
        </p>
      </div>
    </div>
  )
}
