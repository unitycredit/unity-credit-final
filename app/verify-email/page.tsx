import { Suspense } from 'react'
import VerifyEmailClient from './verify-email-client'

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#001f3f] via-[#003d7a] to-[#001f3f] flex items-center justify-center">
          <div className="text-white rtl-text">לייגט אן...</div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  )
}

