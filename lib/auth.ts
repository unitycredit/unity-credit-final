import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

function normEmail(email: unknown) {
  return String(email || '').trim().toLowerCase()
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
        const email = normEmail(credentials?.email)
        const password = String(credentials?.password || '')

        if (!email || !email.includes('@') || password.length < 1) return null

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

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined,
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

