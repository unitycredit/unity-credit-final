'use client'

import { WorkModeProvider } from '@/components/work/WorkModeContext'
import WorkSidebar from '@/components/work/WorkSidebar'
import WorkHeader from '@/components/work/WorkHeader'
import MobileNav from '@/components/work/MobileNav'

export default function WorkLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <WorkModeProvider>
      <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
        {/* Desktop sidebar */}
        <WorkSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0">
          <WorkHeader />
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </WorkModeProvider>
  )
}
