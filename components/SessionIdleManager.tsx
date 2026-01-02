'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOutAction } from '@/lib/actions/auth'

type Props = {
  /** Idle timeout in minutes before forced logout */
  idleMinutes?: number
  /** Ping interval in minutes while user is active (keeps session fresh) */
  pingMinutes?: number
}

export default function SessionIdleManager({ idleMinutes = 30, pingMinutes = 5 }: Props) {
  const router = useRouter()
  const lastActivityRef = useRef<number>(Date.now())
  const lastPingRef = useRef<number>(0)
  const signingOutRef = useRef<boolean>(false)

  useEffect(() => {
    const idleMs = Math.max(1, idleMinutes) * 60_000
    const pingMs = Math.max(1, pingMinutes) * 60_000

    function markActivity() {
      lastActivityRef.current = Date.now()
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown']
    for (const ev of events) window.addEventListener(ev, markActivity, { passive: true })
    document.addEventListener('visibilitychange', markActivity)
    window.addEventListener('focus', markActivity)

    const tick = window.setInterval(() => {
      const now = Date.now()
      const idleFor = now - lastActivityRef.current

      // If logged out already, stop doing work.
      if (signingOutRef.current) return

      // Keepalive ping while active (only if the user has been active recently).
      const activeRecently = idleFor < pingMs
      if (activeRecently && now - lastPingRef.current >= pingMs) {
        lastPingRef.current = now
        fetch('/api/auth/ping', { cache: 'no-store' }).catch(() => null)
      }

      // Hard idle logout.
      if (idleFor >= idleMs) {
        signingOutRef.current = true
        ;(async () => {
          await signOutAction().catch(() => null)
          router.replace('/login?reason=idle')
        })()
      }
    }, 10_000)

    return () => {
      window.clearInterval(tick)
      for (const ev of events) window.removeEventListener(ev, markActivity as any)
      document.removeEventListener('visibilitychange', markActivity)
      window.removeEventListener('focus', markActivity)
    }
  }, [idleMinutes, pingMinutes, router])

  return null
}


