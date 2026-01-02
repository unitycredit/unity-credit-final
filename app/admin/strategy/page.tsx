import { createHmac } from 'node:crypto'
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { resolveAdminSecret } from '@/lib/admin-secret'
import AdminStrategyChat from '@/components/AdminStrategyChat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminStrategyPage() {
  // Dev/localhost bypass: allow viewing without admin cookie in local dev.
  try {
    if (process.env.NODE_ENV !== 'production') {
      const h = await headers()
      const host = String(h.get('x-forwarded-host') || h.get('host') || '').toLowerCase()
      const isLocal = host.startsWith('localhost:') || host === 'localhost' || host.startsWith('127.0.0.1:') || host === '127.0.0.1'
      if (isLocal) {
        return (
          <div className="min-h-screen bg-white p-6">
            <div className="max-w-5xl mx-auto">
              <AdminStrategyChat />
            </div>
          </div>
        )
      }
    }
  } catch {
    // ignore
  }

  const resolved = resolveAdminSecret(null)
  const secret = resolved.enabled ? resolved.secret : ''
  if (!secret) notFound()

  const token = createHmac('sha256', secret).update('uc_admin_v1').digest('hex')
  const cookieToken = (await cookies()).get('uc_admin')?.value || ''
  const authed = Boolean(cookieToken && token && cookieToken === token)
  if (!authed) notFound()

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-5xl mx-auto">
        <AdminStrategyChat />
      </div>
    </div>
  )
}


