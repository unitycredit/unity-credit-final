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
  debug: process.env.NODE_ENV !== 'production',
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
        const authDebug = process.env.NODE_ENV !== 'production' || String(process.env.UC_AUTH_DEBUG || '').trim() === 'true'

        // 1) Primary: RDS Postgres users table (email/password). (No Cognito.)
        if (isEmail) {
          const email = identifier
          const hasDbEnv = Boolean(
            String(process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim() ||
              (String(process.env.DB_HOST || '').trim() && String(process.env.DB_PASSWORD || '').trim())
          )
          if (authDebug) {
            // eslint-disable-next-line no-console
            console.log('[AUTH] credentials email login attempt', {
              email,
              hasDbEnv,
              hasNextAuthSecret: Boolean(String(process.env.NEXTAUTH_SECRET || '').trim()),
            })
          }

          if (!hasDbEnv) {
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] Missing DB env; refusing login because Unity Credit requires RDS', { email })
            }
            throw new Error('DB_NOT_CONFIGURED')
          }

          try {
            const dbUser =
              (await prisma.user
                .findUnique({
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
                .catch(() => null)) || null

            if (!dbUser?.id || !dbUser.passwordHash) {
              if (authDebug) {
                // eslint-disable-next-line no-console
                console.warn('[AUTH] user not found or missing passwordHash', { email })
              }
              return null
            }

            const requireVerified =
              process.env.NODE_ENV === 'production' && String(process.env.UC_REQUIRE_EMAIL_VERIFICATION || '').trim() !== 'false'
            if (requireVerified && !dbUser.emailVerifiedAt) {
              throw new Error('EMAIL_NOT_VERIFIED')
            }

            const ok = await verifyPassword(password, dbUser.passwordHash)
            if (!ok) {
              if (authDebug) {
                // eslint-disable-next-line no-console
                console.warn('[AUTH] password mismatch (email login)', { email, hashPrefix: String(dbUser.passwordHash || '').slice(0, 20) })
              }
              return null
            }

            return {
              id: dbUser.id,
              email: dbUser.email || email,
              name: [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ').trim() || undefined,
            }
          } catch (e: any) {
            const msg = String(e?.message || '')
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] RDS credential auth failed', { email, error: msg.slice(0, 200) || null })
            }
            if (msg.includes('Missing DATABASE_URL') || msg.includes('DB_HOST') || msg.includes('Prisma')) {
              throw new Error('DB_NOT_CONFIGURED')
            }
            throw new Error('DB_CONNECT_FAILED')
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
        if (!ok) {
          if (authDebug) {
            // eslint-disable-next-line no-console
            console.warn('[AUTH] password mismatch (unity_users login)', {
              username: identifier,
              hashPrefix: String(admin.hashed_password || '').slice(0, 20),
            })
          }
          return null
        }

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

