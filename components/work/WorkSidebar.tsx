'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  MessageSquare,
  CalendarDays,
  DollarSign,
  BarChart3,
  Layers,
  Settings,
} from 'lucide-react'

const navItems = [
  { href: '/work', label: 'Home', icon: Home },
  { href: '/work/communication', label: 'Communication', icon: MessageSquare },
  { href: '/work/planning', label: 'Work Planning', icon: CalendarDays },
  { href: '/work/money', label: 'Money Awareness', icon: DollarSign },
  { href: '/work/insights', label: 'Insights', icon: BarChart3 },
  { href: '/work/services', label: 'AI Services', icon: Layers },
]

export default function WorkSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 border-r border-slate-700/50 backdrop-blur-xl">
      {/* Brand */}
      <div className="p-6 border-b border-slate-700/50">
        <Link href="/work" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-sm">UW</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Unity Work</h1>
            <p className="text-[10px] text-slate-400 font-medium">AI Work Layer</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/work' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${active
                  ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-white border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }
              `}
            >
              <Icon className={`w-4.5 h-4.5 ${active ? 'text-blue-400' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-slate-700/50">
        <Link
          href="/work/services"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
        >
          <Settings className="w-4.5 h-4.5" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
