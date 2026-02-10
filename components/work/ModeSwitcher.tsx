'use client'

import { useWorkMode, type WorkMode } from './WorkModeContext'
import { Eye, Users, Zap } from 'lucide-react'

const modes: { key: WorkMode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    key: 'advisor',
    label: 'Advisor',
    desc: 'AI analyzes & gives insights',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    key: 'copilot',
    label: 'Co-Pilot',
    desc: 'AI prepares, you approve',
    icon: <Users className="w-4 h-4" />,
  },
  {
    key: 'autopilot',
    label: 'Autopilot',
    desc: 'AI handles routine tasks',
    icon: <Zap className="w-4 h-4" />,
  },
]

export default function ModeSwitcher() {
  const { mode, setMode } = useWorkMode()

  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-800/60 p-1 border border-slate-700/50">
      {modes.map((m) => {
        const active = mode === m.key
        return (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${active
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }
            `}
            title={m.desc}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
