# CLAUDE.md - UnityCredit Codebase Guide

## Overview

UnityCredit is an enterprise financial services platform for credit card management, savings optimization, and professional financial guidance. Built with Next.js 15 (App Router) + React 19 + TypeScript + Prisma/PostgreSQL. Includes RTL/Yiddish language support.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript 5.3, Tailwind CSS 3.4, Shadcn/UI, React Hook Form + Zod
- **Backend**: Node.js 20+, Prisma 7.2 (PostgreSQL), NextAuth 4.24, Server Actions
- **Services**: AWS Cognito, AWS SES v2, Plaid, Stripe, Upstash Redis, Supabase
- **Deployment**: AWS App Runner (port 8080), Docker, Vercel-compatible

## Project Structure

```
app/                    # Next.js App Router pages and API routes
  api/                  # 30+ API route groups (admin, optimization, shopping, deals, etc.)
  admin/                # Admin dashboard
  dashboard/            # User dashboard
  login/, signup/       # Auth pages
  layout.tsx            # Root layout (RTL, providers)
lib/                    # Core business logic (~120 modules)
  actions/              # Server Actions (auth, cards, language, plaid)
  ai/                   # AI integration
  aws/                  # AWS clients (Cognito, SES, Secrets Manager)
  finance/              # Financial calculations
  services/             # Service layer
  unity-brain/          # Brain service client + agents
  auth.ts               # NextAuth config + password verification
  prisma.ts             # Prisma client initialization
  validations.ts        # Zod schemas
  security.ts           # Rate limiting, sanitization
components/             # React UI components (~45)
  ui/                   # Shadcn/UI component library
prisma/
  schema.prisma         # Database schema (User, CreditCard, PlaidTransaction, etc.)
scripts/                # Setup, worker, and utility scripts
unity-brain/            # Standalone Express AI/intelligence service
dist-brain/             # Distributed brain service (Docker)
middleware.ts           # Route protection, referral tracking, security headers
```

## Commands

```bash
npm run dev              # Start dev server (auto-validates env, uses .next-dev/)
npm run build            # Production build (outputs to .next/)
npm run start            # Run production server
npm run lint             # ESLint
npm run type-check       # TypeScript validation (tsc --noEmit)
npm run reset:dev        # Clean dev state

# Background workers
npm run optimization:worker
npm run email:worker
npm run shopping:worker
npm run deal-hunter:worker
npm run sales-accelerator:worker
npm run plaid:refresh
```

## Build Notes

- **TypeScript and ESLint errors are ignored during builds** (`next.config.js` lines 8-9). This is intentional for AWS Amplify compatibility but marked as temporary.
- Dev and build use separate output directories (`.next-dev` vs `.next`) to avoid corruption on Windows.
- No formal test framework is configured (no Jest/Vitest).

## Development Bypasses

For local development, these env vars skip auth/verification:
- `UNITYCREDIT_DEV_BYPASS_AUTH=true` - Skip middleware auth checks
- `NEXT_PUBLIC_DEV_GUEST_MODE=true` - Enable guest mode
- `UC_REQUIRE_EMAIL_VERIFICATION=false` - Skip email verification
- `?bypass=1` query param - Sets 1-hour bypass cookie (localhost only)

## Architecture Patterns

### Server Actions
All database mutations use Server Actions (`'use server'` directive) for type-safe, server-side access. API routes are reserved for admin functions, webhooks (Stripe), health checks, and WebSocket endpoints.

### Authentication
- NextAuth credentials provider with email/password
- Passwords verified via bcrypt (user-created) or PBKDF2-SHA256 (Python admin-seeded)
- Middleware enforces session checks on protected routes
- AWS Cognito optional (configured via env vars)

### Security
- Zod validation on all inputs
- Rate limiting (in-memory dev, Redis production) keyed by IP + email hash
- HTML sanitization for XSS prevention
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- RLS policies for data isolation
- Audit logging (`lib/audit-trail.ts`)

### Database
- Prisma ORM with PostgreSQL
- UUID primary keys, timestamptz(6) precision
- CASCADE delete on foreign keys
- Schema in `prisma/schema.prisma`
- Run `npx prisma generate` after schema changes

## Code Conventions

- **Components**: PascalCase filenames (`ActiveSavingsFeed.tsx`)
- **Utilities/libs**: camelCase filenames (`auth.ts`, `validations.ts`)
- **Imports**: Use `@/` path alias (maps to project root)
- **Validation**: Zod schemas for all user input
- **User-facing errors**: Written in Yiddish
- **Strict TypeScript**: Enabled in tsconfig
- **Styling**: Tailwind CSS with custom colors (`primary: #001f3f`, `gold: #d4af37`), dark mode via class strategy
- **UI components**: Shadcn/UI (configured in `components.json`)

## Environment Setup

Copy `.env.example` to `.env.local`. Key variable groups:
- Supabase URL + keys
- `NEXTAUTH_SECRET`
- AWS Cognito/SES credentials
- Plaid client ID + secret
- Stripe keys
- `DATABASE_URL` / `POSTGRES_URL`
- Unity Brain endpoint
- Redis URL (Upstash)

The `npm run dev` command auto-validates and syncs env files via `scripts/ensure-env-local.js`.

## Important Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Route protection, referral tracking, maintenance mode, security headers |
| `lib/auth.ts` | NextAuth config, password verification, session management |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/validations.ts` | Zod schemas for all input validation |
| `lib/security.ts` | Rate limiting and sanitization utilities |
| `lib/server-rate-limit.ts` | Rate limiter implementation (memory/Redis) |
| `next.config.js` | Build config, security headers, dev/prod output separation |
| `prisma/schema.prisma` | Database models and relationships |
| `apprunner.yaml` | AWS App Runner deployment config |
