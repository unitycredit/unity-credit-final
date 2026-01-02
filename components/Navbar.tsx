'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOutAction } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Settings, LogOut } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from '@/components/LanguageProvider'
import UnityGlobalSearch from '@/components/UnityGlobalSearch'
import UnityCreditBrandStack from '@/components/UnityCreditBrandStack'
import SupportButton from '@/components/SupportButton'

export default function Navbar() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useI18n()

  const handleLogout = async () => {
    const result = await signOutAction()
    if (result.error) {
      toast({
        title: t('toast.error.title'),
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: t('toast.logout.title'),
        description: t('toast.logout.desc'),
      })
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <nav className="bg-[#001f3f] text-white sticky top-0 z-50 shadow-lg border-b border-[#001f3f]/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <UnityCreditBrandStack
              href="/dashboard"
              size="sm"
              className="hover:opacity-90 transition"
              textClassName="text-white"
              label="UnityCredit"
              aria-label="UnityCredit"
            />
          </div>
          <UnityGlobalSearch />
          <div className="flex items-center gap-4">
            <SupportButton />
            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="bg-[#003d7a] hover:bg-[#0056b3] text-white font-black px-4"
              >
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:text-gold"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="rtl-text hidden sm:inline">{t('nav.logout')}</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
