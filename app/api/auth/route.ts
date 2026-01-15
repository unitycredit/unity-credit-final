import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function ensureDatabaseUrlEnv() {
  // App Runner sometimes uses POSTGRES_URL. Standardize to DATABASE_URL for Prisma.
  if (!String(process.env.DATABASE_URL || '').trim() && String(process.env.POSTGRES_URL || '').trim()) {
    process.env.DATABASE_URL = String(process.env.POSTGRES_URL || '').trim()
  }
}

export async function GET(_req: NextRequest) {
  ensureDatabaseUrlEnv()

  const hasDbUrl = Boolean(String(process.env.DATABASE_URL || '').trim())
  if (!hasDbUrl) {
    return NextResponse.json({ ok: false, error: 'DB_NOT_CONFIGURED' }, { status: 500 })
  }

  try {
    // Lightweight connectivity check.
    await prisma.$queryRaw`select 1`
    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[API_AUTH] DB connection check failed', { error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: 'DB_CONNECT_FAILED' }, { status: 500 })
  }
}

