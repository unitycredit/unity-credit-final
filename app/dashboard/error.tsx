'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep a breadcrumb for debugging without leaking sensitive details to the UI.
    // eslint-disable-next-line no-console
    console.error('Dashboard crashed:', props.error)
  }, [props.error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9fa] via-white to-[#f0f2f5] flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-2xl font-black text-primary rtl-text text-right">דאַשבאָרד־טעות</div>
        <div className="mt-2 text-sm text-slate-600 rtl-text text-right">
          איינע פון די טיילן האט דורכגעפאלן. פרובירט נאכאמאל; אייער דאטן זענען נישט פארלוירן.
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={props.reset}
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}


