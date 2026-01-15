import 'server-only'

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider'

type CognitoBoto3Op =
  | 'sign_up'
  | 'confirm_sign_up'
  | 'resend_confirmation_code'
  | 'initiate_auth'
  | 'forgot_password'
  | 'confirm_forgot_password'

export type CognitoBoto3Result<T> =
  | ({ ok: true } & T)
  | { ok: false; error_code?: string; error?: string; status?: number }

// Unity Credit official Cognito identifiers (NOT secrets).
// These are safe to keep as defaults, and can be overridden by env vars in production.
const DEFAULT_COGNITO_REGION = 'us-east-2'
const DEFAULT_COGNITO_APP_CLIENT_ID = '52r69v50idofp9r4l44p3d03g9'

function region() {
  return String(process.env.AWS_COGNITO_REGION || process.env.AWS_REGION || DEFAULT_COGNITO_REGION).trim()
}

function clientId() {
  return String(process.env.AWS_COGNITO_APP_CLIENT_ID || DEFAULT_COGNITO_APP_CLIENT_ID).trim()
}

let _client: CognitoIdentityProviderClient | null = null
function getClient() {
  const r = region()
  if (!r) throw new Error('Missing AWS_COGNITO_REGION (or AWS_REGION).')
  if (_client) return _client
  _client = new CognitoIdentityProviderClient({ region: r })
  return _client
}

function decodeJwtPayload(idToken: string) {
  const t = String(idToken || '').trim()
  if (!t) return {}
  const parts = t.split('.')
  if (parts.length < 2) return {}
  try {
    const payload = Buffer.from(parts[1] || '', 'base64url').toString('utf8')
    const obj = JSON.parse(payload)
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

function mapCognitoError(e: any): { error_code: string; status: number; error: string } {
  const name = String(e?.name || e?.Code || e?.code || 'cognito_error')
  const msg = String(e?.message || '').trim() || 'Cognito error'
  const http = Number(e?.$metadata?.httpStatusCode || 0) || 500

  // AWS SDK v3 credential resolution errors vary by environment.
  if (/credential/i.test(name) || /could not load credentials/i.test(msg) || /Missing credentials/i.test(msg)) {
    return { error_code: 'MissingAWSCredentials', status: 500, error: 'Missing AWS credentials for Cognito.' }
  }

  if (name === 'UserNotConfirmedException') return { error_code: name, status: 403, error: msg }
  if (name === 'NotAuthorizedException') return { error_code: name, status: 401, error: msg }
  if (name === 'UsernameExistsException') return { error_code: name, status: 409, error: msg }
  if (name === 'CodeMismatchException') return { error_code: name, status: 400, error: msg }
  if (name === 'ExpiredCodeException') return { error_code: name, status: 400, error: msg }
  if (name === 'InvalidPasswordException') return { error_code: name, status: 400, error: msg }
  if (name === 'InvalidParameterException') return { error_code: name, status: 400, error: msg }

  return { error_code: name, status: http >= 400 ? http : 500, error: msg }
}

export async function callCognitoBoto3<T = any>(
  op: CognitoBoto3Op,
  payload: Record<string, any>
): Promise<CognitoBoto3Result<T>> {
  const r = region()
  const cid = clientId()
  if (!r) return { ok: false, error_code: 'missing_region', error: 'Missing AWS_COGNITO_REGION (or AWS_REGION).', status: 500 }
  if (!cid) return { ok: false, error_code: 'missing_client_id', error: 'Missing AWS_COGNITO_APP_CLIENT_ID.', status: 500 }

  try {
    const client = getClient()

    if (op === 'sign_up') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      const password = String(payload?.password || '')
      if (!username || !username.includes('@')) return { ok: false, error_code: 'invalid_email', error: 'Invalid email', status: 400 }
      if (!password) return { ok: false, error_code: 'invalid_password', error: 'Missing password', status: 400 }

      const attrs: AttributeType[] = [{ Name: 'email', Value: username }]
      const given = String(payload?.first_name || payload?.given_name || '').trim()
      const family = String(payload?.last_name || payload?.family_name || '').trim()
      const phone = String(payload?.phone || payload?.phone_number || '').trim()
      if (given) attrs.push({ Name: 'given_name', Value: given })
      if (family) attrs.push({ Name: 'family_name', Value: family })
      if (phone) attrs.push({ Name: 'phone_number', Value: phone })

      const resp = await client.send(new SignUpCommand({ ClientId: cid, Username: username, Password: password, UserAttributes: attrs }))
      return {
        ok: true,
        user_sub: resp.UserSub,
        user_confirmed: Boolean(resp.UserConfirmed),
        code_delivery: (resp.CodeDeliveryDetails as any) || null,
      } as any
    }

    if (op === 'confirm_sign_up') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      const code = String(payload?.code || payload?.confirmation_code || '').trim().replace(/\s+/g, '')
      if (!username || !username.includes('@')) return { ok: false, error_code: 'invalid_email', error: 'Invalid email', status: 400 }
      if (!/^\d{6}$/.test(code)) return { ok: false, error_code: 'invalid_code', error: 'Invalid confirmation code', status: 400 }
      await client.send(new ConfirmSignUpCommand({ ClientId: cid, Username: username, ConfirmationCode: code }))
      return { ok: true, confirmed: true } as any
    }

    if (op === 'resend_confirmation_code') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      if (!username || !username.includes('@')) return { ok: false, error_code: 'invalid_email', error: 'Invalid email', status: 400 }
      const resp = await client.send(new ResendConfirmationCodeCommand({ ClientId: cid, Username: username }))
      return { ok: true, code_delivery: (resp.CodeDeliveryDetails as any) || null } as any
    }

    if (op === 'initiate_auth') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      const password = String(payload?.password || '')
      if (!username) return { ok: false, error_code: 'invalid_username', error: 'Missing username', status: 400 }
      if (!password) return { ok: false, error_code: 'invalid_password', error: 'Missing password', status: 400 }

      const resp = await client.send(
        new InitiateAuthCommand({
          ClientId: cid,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: username, PASSWORD: password },
        })
      )
      const result: any = resp.AuthenticationResult || {}
      const claims = decodeJwtPayload(String(result.IdToken || ''))
      return {
        ok: true,
        auth: {
          access_token: result.AccessToken,
          id_token: result.IdToken,
          refresh_token: result.RefreshToken,
          expires_in: result.ExpiresIn,
          token_type: result.TokenType,
        },
        claims: {
          sub: (claims as any)?.sub,
          email: (claims as any)?.email || username,
          email_verified: (claims as any)?.email_verified,
          given_name: (claims as any)?.given_name,
          family_name: (claims as any)?.family_name,
          phone_number: (claims as any)?.phone_number,
        },
      } as any
    }

    if (op === 'forgot_password') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      if (!username || !username.includes('@')) return { ok: false, error_code: 'invalid_email', error: 'Invalid email', status: 400 }
      const resp = await client.send(new ForgotPasswordCommand({ ClientId: cid, Username: username }))
      return { ok: true, code_delivery: (resp.CodeDeliveryDetails as any) || null } as any
    }

    if (op === 'confirm_forgot_password') {
      const username = String(payload?.username || payload?.email || '').trim().toLowerCase()
      const code = String(payload?.code || payload?.confirmation_code || '').trim().replace(/\s+/g, '')
      const newPassword = String(payload?.new_password || payload?.password || '')
      if (!username || !username.includes('@')) return { ok: false, error_code: 'invalid_email', error: 'Invalid email', status: 400 }
      if (!/^\d{6}$/.test(code)) return { ok: false, error_code: 'invalid_code', error: 'Invalid confirmation code', status: 400 }
      if (!newPassword) return { ok: false, error_code: 'invalid_password', error: 'Missing new password', status: 400 }
      await client.send(new ConfirmForgotPasswordCommand({ ClientId: cid, Username: username, ConfirmationCode: code, Password: newPassword }))
      return { ok: true, reset: true } as any
    }

    return { ok: false, error_code: 'unknown_op', error: `Unknown op: ${String(op || '')}`, status: 400 }
  } catch (e: any) {
    const mapped = mapCognitoError(e)
    return { ok: false, ...mapped }
  }
}

