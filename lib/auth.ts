import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

function normEmail(email: unknown) {
  return String(email || '').trim().toLowerCase()
}

function decodeBase64Url(raw: string) {
  const s = String(raw || '').trim()
  if (!s) return Buffer.alloc(0)
  // Node supports base64url; keep a fallback for older runtimes.
  try {
    return Buffer.from(s, 'base64url')
  } catch {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return Buffer.from(padded, 'base64')
  }
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hash = String(storedHash || '').trim()
  if (!hash) return false

  // Python admin seeding uses: pbkdf2_sha256$<iterations>$<salt_b64url>$<digest_b64url>
  if (hash.startsWith('pbkdf2_sha256$')) {
    const parts = hash.split('$')
    if (parts.length !== 4) return false
    const iterations = Number(parts[1] || 0)
    if (!Number.isFinite(iterations) || iterations < 50_000 || iterations > 5_000_000) return false
    const salt = decodeBase64Url(parts[2] || '')
    const expected = decodeBase64Url(parts[3] || '')
    if (salt.length < 8 || expected.length < 16) return false

    const derived = pbkdf2Sync(Buffer.from(String(password || ''), 'utf8'), salt, iterations, expected.length, 'sha256')
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  }

  // Default: bcrypt (most common for app-created users)
  if (hash.startsWith('$2')) {
    return await bcrypt.compare(String(password || ''), hash)
  }

  return false
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const identifierRaw = String(credentials?.email || '').trim()
        const identifier = identifierRaw.toLowerCase()
        const password = String(credentials?.password || '')

        if (!identifier || password.length < 1) return null

        const isEmail = identifier.includes('@')

        // 1) Primary: app users in Postgres `users` table (Prisma model `User`) by email.
        if (isEmail) {
          const email = identifier
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              passwordHash: true,
              emailVerifiedAt: true,
            },
          })

          if (!user?.id || !user.passwordHash) return null

          // Production gate: require email verification before allowing sign-in.
          if (process.env.NODE_ENV === 'production' && !user.emailVerifiedAt) {
            // Allows the client to show a specific UX (OTP verification) instead of "invalid credentials".
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          const ok = await verifyPassword(password, user.passwordHash)
          if (!ok) return null

          return {
            id: user.id,
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined,
          }
        }

        // 2) Admin/legacy: `unity_users` table (seeded by `create_admin.py`) by username.
        // This supports the pbkdf2_sha256 hash format.
        let rows: Array<{ id: number; username: string; hashed_password: string; is_active: boolean }> = []
        try {
          rows = await prisma.$queryRaw<
            Array<{ id: number; username: string; hashed_password: string; is_active: boolean }>
          >`select id, username, hashed_password, is_active from unity_users where lower(username) = ${identifier} limit 1`
        } catch {
          // Table may not exist in some deployments; fail closed (no auth).
          return null
        }
        const admin = rows?.[0]
        if (!admin?.id || !admin.is_active || !admin.hashed_password) return null

        const ok = await verifyPassword(password, admin.hashed_password)
        if (!ok) return null

        return {
          id: `unity:${admin.id}`,
          // Provide an email-shaped value for downstream UI expectations.
          email: `${String(admin.username || 'admin').toLowerCase()}@unitycredit.local`,
          name: admin.username || 'admin',
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        ;(token as any).uid = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = (token as any).uid
      }
      return session
    },
  },
}

