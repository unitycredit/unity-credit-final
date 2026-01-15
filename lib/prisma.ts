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

export const prisma: PrismaClient = globalThis.__UC_PRISMA__ || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalThis.__UC_PRISMA__ = prisma

