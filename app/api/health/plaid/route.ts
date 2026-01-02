import { NextResponse } from 'next/server'
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode } from 'plaid'

export async function GET() {
  const clientId = process.env.PLAID_CLIENT_ID || ''
  const secret = process.env.PLAID_SECRET || ''
  const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()

  if (!clientId || !secret) {
    return NextResponse.json(
      { ok: false, reason: 'Missing Plaid credentials', hasClientId: Boolean(clientId), hasSecret: Boolean(secret) },
      { status: 500 }
    )
  }

  const plaidEnv =
    envName === 'production'
      ? PlaidEnvironments.production
      : envName === 'development'
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox

  const config = new Configuration({
    basePath: plaidEnv,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })
  const plaid = new PlaidApi(config)

  const started = Date.now()
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 2500)

  try {
    // Lightweight authenticated call (no user tokens required)
    await plaid.institutionsGet(
      { count: 1, offset: 0, country_codes: [CountryCode.Us] },
      { signal: controller.signal as any }
    )
    const ms = Date.now() - started
    const res = NextResponse.json({ ok: true, env: envName, ms, now: new Date().toISOString() }, { status: 200 })
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60')
    return res
  } catch (e: any) {
    const ms = Date.now() - started
    const res = NextResponse.json(
      { ok: false, env: envName, ms, error: e?.message || String(e), now: new Date().toISOString() },
      { status: 502 }
    )
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=10, stale-while-revalidate=60')
    return res
  } finally {
    clearTimeout(t)
  }
}


