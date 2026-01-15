import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export type AuthContext =
  | { kind: 'guest' }
  | { kind: 'user'; userId: string; email?: string | null }
  | { kind: 'none' }

export async function getAuthContext(): Promise<AuthContext> {
  const cookieStore = await cookies()
  const bypassCookie = String(cookieStore.get('uc_dev_bypass')?.value || '').trim()
  if (bypassCookie === '1') return { kind: 'guest' }

  const session = await getServerSession(authOptions)
  const userId = String((session as any)?.user?.id || '').trim()
  if (!userId) return { kind: 'none' }

  return { kind: 'user', userId, email: (session as any)?.user?.email || null }
}

