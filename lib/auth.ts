import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { callCognitoBoto3 } from '@/lib/aws/cognito-boto3'

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

        // 1) Primary: Cognito User Pool auth (email/password). We keep a local user row in RDS for app data ownership.
        if (isEmail) {
          const email = identifier
          const hasDbEnv = Boolean(
            String(process.env.DATABASE_URL || '').trim() || (String(process.env.DB_HOST || '').trim() && String(process.env.DB_PASSWORD || '').trim())
          )
          if (authDebug) {
            // eslint-disable-next-line no-console
            console.log('[AUTH] credentials email login attempt', {
              email,
              hasDbEnv,
              hasNextAuthSecret: Boolean(String(process.env.NEXTAUTH_SECRET || '').trim()),
            })
          }

          const cog = await callCognitoBoto3<{ claims?: any }>('initiate_auth', { email, password })
          if (!cog.ok) {
            const code = String((cog as any)?.error_code || '')
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] Cognito auth failed', {
                email,
                error_code: code || null,
                status: (cog as any)?.status || null,
                error: String((cog as any)?.error || '').slice(0, 200) || null,
              })
            }
            if (code === 'UserNotConfirmedException') {
              throw new Error('EMAIL_NOT_VERIFIED')
            }
            if (code === 'NotAuthorizedException') return null
            if (code === 'MissingAWSCredentials') {
              throw new Error('COGNITO_MISSING_AWS_CREDS')
            }
            if (code === 'cognito_boto3_failed') {
              throw new Error('COGNITO_HELPER_FAILED')
            }
            // Fail closed (do not leak internal errors as "invalid password").
            throw new Error(code ? `COGNITO_${code}` : 'COGNITO_AUTH_FAILED')
          }

          const claims = (cog as any)?.claims || {}
          const emailVerified = Boolean(claims?.email_verified)

          // Production gate: require Cognito email verification before allowing sign-in.
          if (process.env.NODE_ENV === 'production' && !emailVerified) {
            throw new Error('EMAIL_NOT_VERIFIED')
          }

          const firstName = String(claims?.given_name || '').trim() || null
          const lastName = String(claims?.family_name || '').trim() || null
          const phone = String(claims?.phone_number || '').trim() || null

          // Ensure user row exists in RDS (used as the internal user id across the app).
          if (!hasDbEnv) {
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] Missing DB env; refusing login because Unity Credit requires RDS user row', { email })
            }
            throw new Error('DB_NOT_CONFIGURED')
          }

          let dbUser: any = null
          try {
            dbUser =
              (await prisma.user
                .findUnique({
                  where: { email },
                  select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
                })
                .catch(() => null)) || null

            if (!dbUser?.id) {
              dbUser =
                (await prisma.user
                  .create({
                    data: {
                      email,
                      ...(firstName ? { firstName } : {}),
                      ...(lastName ? { lastName } : {}),
                      ...(phone ? { phone } : {}),
                      ...(emailVerified ? { emailVerifiedAt: new Date() } : {}),
                    } as any,
                    select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
                  })
                  .catch(() => null)) || null
            } else {
              // Best-effort: keep profile fields fresh (only fill missing values).
              const needsUpdate =
                (emailVerified && !dbUser.emailVerifiedAt) ||
                (!dbUser.firstName && firstName) ||
                (!dbUser.lastName && lastName) ||
                (!dbUser.phone && phone)
              if (needsUpdate) {
                dbUser =
                  (await prisma.user
                    .update({
                      where: { id: dbUser.id },
                      data: {
                        ...(emailVerified && !dbUser.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
                        ...(!dbUser.firstName && firstName ? { firstName } : {}),
                        ...(!dbUser.lastName && lastName ? { lastName } : {}),
                        ...(!dbUser.phone && phone ? { phone } : {}),
                      } as any,
                      select: { id: true, email: true, firstName: true, lastName: true, phone: true, emailVerifiedAt: true },
                    })
                    .catch(() => null)) || dbUser
              }
            }
          } catch {
            // Surface DB connectivity separately so the UI can show the right message.
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] RDS/Prisma operation failed (exception)', { email })
            }
            throw new Error('DB_CONNECT_FAILED')
          }

          if (!dbUser?.id) {
            // If Cognito auth succeeded but DB row couldn't be created, treat as DB issue (not invalid credentials).
            if (authDebug) {
              // eslint-disable-next-line no-console
              console.error('[AUTH] RDS user row missing after Cognito auth', { email })
            }
            throw new Error('DB_CONNECT_FAILED')
          }

          return {
            id: dbUser.id,
            email: dbUser.email || email,
            name: [dbUser.firstName, dbUser.lastName].filter(Boolean).join(' ').trim() || undefined,
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

