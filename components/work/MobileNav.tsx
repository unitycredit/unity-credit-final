'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, CalendarDays, DollarSign, BarChart3 } from 'lucide-react'

const navItems = [
  { href: '/work', label: 'Home', icon: Home },
  { href: '/work/communication', label: 'Comms', icon: MessageSquare },
  { href: '/work/planning', label: 'Plan', icon: CalendarDays },
  { href: '/work/money', label: 'Money', icon: DollarSign },
  { href: '/work/insights', label: 'Insights', icon: BarChart3 },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/work' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all
                ${active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
