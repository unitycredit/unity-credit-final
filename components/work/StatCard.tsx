'use client'

interface StatCardProps {
  label: string
  value: string
  subtext?: string
  icon: React.ReactNode
  trend?: { value: string; positive: boolean }
  accent?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'violet'
}

const accentStyles = {
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
  amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
  indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20',
  violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
}

const iconBg = {
  blue: 'bg-blue-500/20 text-blue-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/20 text-amber-400',
  indigo: 'bg-indigo-500/20 text-indigo-400',
  violet: 'bg-violet-500/20 text-violet-400',
}

export default function StatCard({ label, value, subtext, icon, trend, accent = 'blue' }: StatCardProps) {
  return (
    <div className={`
      rounded-xl border bg-gradient-to-br p-5 transition-all duration-200 hover:shadow-lg
      ${accentStyles[accent]}
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${iconBg[accent]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.positive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {subtext && <p className="text-[10px] text-slate-500 mt-1">{subtext}</p>}
    </div>
  )
}
