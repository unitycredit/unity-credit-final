import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __UC_PRISMA__: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Fail loudly: almost every server request needs DB in production.
    throw new Error('Missing DATABASE_URL (required for Prisma/Postgres).')
  }
  const pool = new Pool({ connectionString })
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

