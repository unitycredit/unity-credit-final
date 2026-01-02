'use client'

import { useEffect } from 'react'

export default function ActivityPing({ intervalMs = 15000 }: { intervalMs?: number }) {
  useEffect(() => {
    let cancelled = false

    async function ping() {
      try {
        await fetch('/api/activity/ping', { method: 'POST', cache: 'no-store' })
      } catch {
        // ignore
      }
    }

    // Fire once quickly, then poll.
    ping()
    const id = window.setInterval(() => {
      if (cancelled) return
      ping()
    }, Math.max(5000, intervalMs))

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [intervalMs])

  return null
}


