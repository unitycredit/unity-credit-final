'use server'

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { createClient } from '@/lib/supabase'

type LinkTokenResult = { link_token: string } | { error: string }

export async function createPlaidLinkTokenAction(): Promise<LinkTokenResult> {
  try {
    const clientId = process.env.PLAID_CLIENT_ID
    const secret = process.env.PLAID_SECRET
    const envName = (process.env.PLAID_ENV || 'sandbox').toLowerCase()
    const redirectUri = process.env.PLAID_REDIRECT_URI || undefined

    if (!clientId || !secret) {
      return { error: 'פלאיד־קרעדענשעלס פעלן (PLAID_CLIENT_ID / PLAID_SECRET).' }
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

    // Require authenticated user (Plaid must not be usable without login).
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const client_user_id = data?.user?.id || null

    if (!client_user_id) {
      return { error: 'ביטע לאָגט איין כדי צו פארבינדן א באנק־אקאונט.' }
    }

    const resp = await plaid.linkTokenCreate({
      user: { client_user_id },
      client_name: 'Unity Credit',
      // NOTE: Adding Identity requires re-linking in Plaid Link for existing connections.
      products: [Products.Transactions, Products.Identity],
      language: 'en',
      country_codes: [CountryCode.Us],
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    })

    return { link_token: resp.data.link_token }
  } catch {
    return { error: 'עס איז נישט געלונגען צו צוגרייטן די באנק־פארבינדונג. ביטע פרובירט נאכאמאל.' }
  }
}


