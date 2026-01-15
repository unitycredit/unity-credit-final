import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __UC_PRISMA__: PrismaClient | undefined
}

function resolveDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || '').trim()
  if (direct) return direct

  const host = String(process.env.DB_HOST || '').trim()
  const port = String(process.env.DB_PORT || '5432').trim()
  const user = String(process.env.DB_USER || 'postgres').trim()
  const password = String(process.env.DB_PASSWORD || '').trim()
  const db = String(process.env.DB_NAME || 'postgres').trim()

  if (!host || !password) return ''

  // Ensure special characters in password are safe in URL.
  const encPw = encodeURIComponent(password)
  // Prisma commonly expects schema query param; default Postgres schema is public.
  return `postgresql://${encodeURIComponent(user)}:${encPw}@${host}:${encodeURIComponent(port)}/${encodeURIComponent(db)}?schema=public`
}

function shouldUseSsl(connectionString: string) {
  // Support common env conventions.
  const mode = String(process.env.PGSSLMODE || '').trim().toLowerCase()
  if (mode === 'require' || mode === 'verify-full' || mode === 'verify-ca') return true
  if (String(process.env.DB_SSL || '').trim() === 'true') return true

  // Also support URL query hints (even if not standard in node-postgres).
  try {
    const u = new URL(connectionString)
    const ssl = String(u.searchParams.get('ssl') || '').toLowerCase()
    const sslmode = String(u.searchParams.get('sslmode') || '').toLowerCase()
    if (ssl === 'true' || ssl === '1') return true
    if (sslmode === 'require' || sslmode === 'verify-full' || sslmode === 'verify-ca') return true
  } catch {
    // ignore
  }
  return false
}

function createPrismaClient() {
  const connectionString = resolveDatabaseUrl()
  if (!connectionString) {
    // Fail loudly: almost every server request needs DB in production.
    throw new Error('Missing DATABASE_URL (or DB_HOST/DB_PASSWORD) required for Prisma/Postgres.')
  }
  const pool = new Pool({
    connectionString,
    ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : null),
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

function prismaStub(err: unknown): PrismaClient {
  const e = err instanceof Error ? err : new Error(String(err || 'Prisma not configured'))
  return new Proxy({} as PrismaClient, {
    get() {
      throw e
    },
    set() {
      throw e
    },
  })
}

let resolved: PrismaClient
try {
  resolved = globalThis.__UC_PRISMA__ || createPrismaClient()
  if (process.env.NODE_ENV !== 'production') globalThis.__UC_PRISMA__ = resolved
} catch (e) {
  // Important for Next.js builds: route modules can be imported during `next build`.
  // We defer failing until runtime (first actual DB usage).
  resolved = prismaStub(e)
}

export const prisma: PrismaClient = resolved

