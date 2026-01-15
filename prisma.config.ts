import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

// Prisma CLI does not automatically load Next.js env files in Prisma 7+.
// Load the common Next.js env files if present.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

export default defineConfig({
  datasource: {
    // Allow tooling (generate/typecheck) to run even if DATABASE_URL isn't present yet.
    // The app will still fail fast at runtime in `lib/prisma.ts` if DATABASE_URL is missing.
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/unitycredit?schema=public',
  },
})

