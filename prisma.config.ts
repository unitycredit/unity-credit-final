import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

// Prisma CLI does not automatically load Next.js env files in Prisma 7+.
// Load the common Next.js env files if present.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

function resolveDatabaseUrl() {
  const direct = String(process.env.DATABASE_URL || '').trim()
  if (direct) return direct

  const host = String(process.env.DB_HOST || '').trim()
  const port = String(process.env.DB_PORT || '5432').trim()
  const user = String(process.env.DB_USER || 'postgres').trim()
  const password = String(process.env.DB_PASSWORD || '').trim()
  const db = String(process.env.DB_NAME || 'postgres').trim()

  if (!host || !password) return ''

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${encodeURIComponent(port)}/${encodeURIComponent(db)}?schema=public`
}

export default defineConfig({
  datasource: {
    // Allow tooling (generate/typecheck) to run even if DATABASE_URL isn't present yet.
    // The app will still fail fast at runtime in `lib/prisma.ts` if DATABASE_URL is missing.
    url:
      resolveDatabaseUrl() ||
      'postgresql://postgres:postgres@localhost:5432/unitycredit?schema=public',
  },
})

