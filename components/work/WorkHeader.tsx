'use client'

import ModeSwitcher from './ModeSwitcher'
import { useWorkMode } from './WorkModeContext'
import { Bell, Menu } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  MessageSquare,
  CalendarDays,
  DollarSign,
  BarChart3,
  Layers,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/work', label: 'Home', icon: Home },
  { href: '/work/communication', label: 'Communication', icon: MessageSquare },
  { href: '/work/planning', label: 'Work Planning', icon: CalendarDays },
  { href: '/work/money', label: 'Money Awareness', icon: DollarSign },
  { href: '/work/insights', label: 'Insights', icon: BarChart3 },
  { href: '/work/services', label: 'AI Services', icon: Layers },
]

const modeLabels = {
  advisor: 'Advisor Mode — AI analyzes and gives insights',
  copilot: 'Co-Pilot Mode — AI prepares, you approve',
  autopilot: 'Autopilot Mode — AI handles routine tasks',
}

export default function WorkHeader() {
  const { mode } = useWorkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          {/* Mobile menu button + Logo */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">UW</span>
              </div>
              <span className="text-sm font-bold text-white">Unity Work</span>
            </div>
          </div>

          {/* Mode status + Switcher */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-xs text-slate-500">{modeLabels[mode]}</span>
            <ModeSwitcher />
          </div>

          {/* Mobile mode switcher */}
          <div className="md:hidden">
            <ModeSwitcher />
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
          </button>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-700/50 animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">UW</span>
                </div>
                <span className="text-sm font-bold text-white">Unity Work</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/work' && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${active
                        ? 'bg-blue-600/20 text-white border border-blue-500/30'
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
          </div>
        </div>
      )}
    </>
  )
}
