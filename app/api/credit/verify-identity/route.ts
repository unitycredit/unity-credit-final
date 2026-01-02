import { NextRequest, NextResponse } from 'next/server'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { readStoredPlaidTokens } from '@/lib/plaid-token-store'

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew niqqud/cantillation
    .replace(/[^a-z0-9\u0590-\u05FF\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function readLatestToken() {
  const items = await readStoredPlaidTokens().catch(() => [])
  if (!Array.isArray(items) || items.length === 0) return null
  const sorted = [...items].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  return sorted[0] || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const legalName = String(body?.legal_name || '').trim()
    if (!legalName) {
      return NextResponse.json({ error: 'Missing legal_name' }, { status: 400 })
    }

    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()

    if (!clientId || !secret) {
      return NextResponse.json({ error: 'Missing Plaid credentials' }, { status: 500 })
    }

    const token = await readLatestToken()
    if (!token?.access_token) {
      return NextResponse.json(
        { error: 'No linked bank token found yet. Please connect a bank first.' },
        { status: 400 }
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

    // Plaid Identity: returns owners/names/emails/phones/addresses (varies by institution).
    // Note: Plaid does NOT verify SSN; this is "best effort" bank-owner name matching.
    const identityResp = await (plaid as any).identityGet({ access_token: token.access_token })
    const accounts = (identityResp?.data as any)?.accounts || []

    const bankNames: string[] = []
    for (const acct of accounts) {
      const owners = Array.isArray((acct as any)?.owners) ? (acct as any).owners : []
      for (const o of owners) {
        const names = Array.isArray((o as any)?.names) ? (o as any).names : []
        for (const n of names) {
          if (typeof n === 'string' && n.trim()) bankNames.push(n.trim())
        }
      }
    }

    const input = norm(legalName)
    const matched =
      input.length > 0 &&
      bankNames.some((n) => {
        const bn = norm(n)
        return bn === input || bn.includes(input) || input.includes(bn)
      })

    return NextResponse.json({
      ok: true,
      verified: matched,
      method: 'plaid_identity_name_match',
      bank_names: bankNames.slice(0, 8),
      note:
        'Plaid Identity is used for best-effort name matching. SSN/DOB verification + credit pull requires a credit-bureau provider.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Identity verification failed. Please re-link with Identity enabled.' },
      { status: 500 }
    )
  }
}


