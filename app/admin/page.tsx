import { createHmac } from 'node:crypto'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'
import { notFound } from 'next/navigation'
import { resolveAdminSecret } from '@/lib/admin-secret'
import { cookies, headers } from 'next/headers'

export const runtime = 'nodejs'

export default async function AdminPage({
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Dev/localhost bypass: allow viewing the admin dashboard without the admin cookie
  // so the UI can be verified immediately. Never enabled in production.
  try {
    if (process.env.NODE_ENV !== 'production') {
      const h = await headers()
      const host = String(h.get('x-forwarded-host') || h.get('host') || '').toLowerCase()
      const isLocal =
        host.startsWith('localhost:') || host === 'localhost' || host.startsWith('127.0.0.1:') || host === '127.0.0.1'
      if (isLocal) {
        return <SuperAdminDashboard />
      }
    }
  } catch {
    // ignore
  }

  const resolved = resolveAdminSecret(null)
  const secret = resolved.enabled ? resolved.secret : ''

  if (!secret) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-black rtl-text text-right">אַדמין</h1>
          <p className="mt-2 text-sm text-slate-600">
            <span className="rtl-text text-right">
              אַדמין איז דיסעיבלד. לייגט אריין <code className="font-mono">ADMIN_SECRET</code> כדי צו אקטיוויזירן.
            </span>
          </p>
        </div>
      </div>
    )
  }

  const token = secret ? createHmac('sha256', secret).update('uc_admin_v1').digest('hex') : ''
  const cookieToken = (await cookies()).get('uc_admin')?.value || ''
  const authed = Boolean(secret && cookieToken && token && cookieToken === token)

  if (!authed) notFound()

  return <SuperAdminDashboard />
}


