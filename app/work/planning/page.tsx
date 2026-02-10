'use client'

import { useState } from 'react'
import {
  CalendarDays,
  Clock,
  Target,
  CheckCircle2,
  Circle,
  Plus,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  LayoutList,
} from 'lucide-react'
import StatCard from '@/components/work/StatCard'
import { useWorkMode } from '@/components/work/WorkModeContext'

type View = 'daily' | 'weekly'

const dailyTasks = [
  { id: 1, title: 'Review Q1 budget proposal', time: '9:00 AM', duration: '45 min', status: 'done' as const, priority: 'high' as const },
  { id: 2, title: 'Team standup meeting', time: '10:00 AM', duration: '15 min', status: 'done' as const, priority: 'medium' as const },
  { id: 3, title: 'Write client presentation outline', time: '10:30 AM', duration: '1.5 hrs', status: 'current' as const, priority: 'high' as const },
  { id: 4, title: 'Lunch break', time: '12:00 PM', duration: '1 hr', status: 'upcoming' as const, priority: 'low' as const },
  { id: 5, title: 'Product strategy call', time: '1:30 PM', duration: '30 min', status: 'upcoming' as const, priority: 'high' as const },
  { id: 6, title: 'Code review for feature branch', time: '2:30 PM', duration: '45 min', status: 'upcoming' as const, priority: 'medium' as const },
  { id: 7, title: 'Process weekly invoices', time: '3:30 PM', duration: '30 min', status: 'upcoming' as const, priority: 'medium' as const },
  { id: 8, title: 'End-of-day wrap-up & plan tomorrow', time: '4:30 PM', duration: '15 min', status: 'upcoming' as const, priority: 'low' as const },
]

const weeklyGoals = [
  { id: 1, title: 'Complete client onboarding package', progress: 80, deadline: 'Wed', status: 'on-track' as const },
  { id: 2, title: 'Finalize Q2 hiring plan', progress: 45, deadline: 'Thu', status: 'at-risk' as const },
  { id: 3, title: 'Ship product feature v2.1', progress: 95, deadline: 'Fri', status: 'on-track' as const },
  { id: 4, title: 'Prepare investor update deck', progress: 20, deadline: 'Fri', status: 'behind' as const },
]

const statusStyles = {
  done: 'text-emerald-400',
  current: 'text-blue-400',
  upcoming: 'text-slate-500',
}

const goalStatusColors = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-amber-500',
  'behind': 'bg-red-500',
}

export default function WorkPlanningHub() {
  const [view, setView] = useState<View>('daily')
  const { mode } = useWorkMode()

  const completedCount = dailyTasks.filter((t) => t.status === 'done').length

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Work Planning Hub</h2>
          <p className="text-sm text-slate-400 mt-1">AI organizes your daily and weekly work plan.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1 border border-slate-700/50">
          <button
            onClick={() => setView('daily')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              view === 'daily' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Daily Plan
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              view === 'weekly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Weekly Goals
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tasks Today"
          value={`${completedCount}/${dailyTasks.length}`}
          icon={<LayoutList className="w-5 h-5" />}
          accent="blue"
        />
        <StatCard
          label="Focus Time"
          value="3.5 hrs"
          subtext="Blocked for deep work"
          icon={<Target className="w-5 h-5" />}
          accent="indigo"
        />
        <StatCard
          label="Weekly Progress"
          value="62%"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={{ value: '12%', positive: true }}
          accent="emerald"
        />
        <StatCard
          label="Deadlines This Week"
          value="4"
          subtext="1 at risk"
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
        />
      </div>

      {view === 'daily' && (
        <div className="space-y-6">
          {/* Daily timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-400" />
                Today&apos;s Plan
              </h3>
              <span className="text-xs text-slate-500">
                {mode === 'copilot' ? 'AI suggested • You approved' : 'AI generated'}
              </span>
            </div>

            <div className="space-y-2">
              {dailyTasks.map((task) => (
                <div
                  key={task.id}
                  className={`
                    flex items-center gap-4 rounded-xl border p-4 transition-all
                    ${task.status === 'current'
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-slate-700/50 bg-slate-800/40'
                    }
                  `}
                >
                  {/* Status icon */}
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : task.status === 'current' ? (
                    <div className="relative flex-shrink-0">
                      <Circle className="w-5 h-5 text-blue-400" />
                      <div className="absolute inset-0 w-5 h-5 rounded-full bg-blue-400/20 animate-ping" />
                    </div>
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {task.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${statusStyles[task.status]}`}>{task.time}</span>
                      <span className="text-[10px] text-slate-600">•</span>
                      <span className="text-[10px] text-slate-500">{task.duration}</span>
                    </div>
                  </div>

                  {/* Priority */}
                  <span className={`
                    text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0
                    ${task.priority === 'high'
                      ? 'text-red-400 bg-red-500/10 border-red-500/30'
                      : task.priority === 'medium'
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                    }
                  `}>
                    {task.priority}
                  </span>

                  {task.status === 'current' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium flex-shrink-0">
                      In progress
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-700/50 text-sm text-slate-500 hover:text-white hover:border-blue-500/30 transition-all">
              <Plus className="w-4 h-4" />
              Add task
            </button>
          </div>
        </div>
      )}

      {view === 'weekly' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              Weekly Goals
            </h3>
            <span className="text-xs text-slate-500">Week of Feb 10 – 14</span>
          </div>

          <div className="space-y-4">
            {weeklyGoals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{goal.title}</h4>
                    <span className="text-[10px] text-slate-500">Due: {goal.deadline}</span>
                  </div>
                  <span className={`
                    text-[10px] px-2 py-0.5 rounded-full font-medium
                    ${goal.status === 'on-track'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : goal.status === 'at-risk'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }
                  `}>
                    {goal.status === 'on-track' ? 'On Track' : goal.status === 'at-risk' ? 'At Risk' : 'Behind'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${goalStatusColors[goal.status]}`}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-500">{goal.progress}% complete</span>
                  {goal.status === 'behind' && (
                    <span className="text-[10px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Needs attention
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-700/50 text-sm text-slate-500 hover:text-white hover:border-blue-500/30 transition-all">
            <Plus className="w-4 h-4" />
            Add weekly goal
          </button>
        </div>
      )}
    </div>
  )
}
