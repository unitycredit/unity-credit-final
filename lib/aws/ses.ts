import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export type SesConfig = {
  region: string
  fromEmail: string
  ok: boolean
}

export function sesConfig(): SesConfig {
  const region = String(process.env.SES_REGION || process.env.AWS_REGION || '').trim()
  const fromEmail = String(process.env.SES_FROM_EMAIL || '').trim()
  return { region, fromEmail, ok: Boolean(region && fromEmail) }
}

let _client: SESv2Client | null = null
function getClient() {
  const cfg = sesConfig()
  if (!cfg.region) throw new Error('Missing SES_REGION (or AWS_REGION).')
  if (_client) return _client
  _client = new SESv2Client({ region: cfg.region })
  return _client
}

export async function sendSesEmail(params: { to: string; subject: string; html?: string; text?: string }) {
  const cfg = sesConfig()
  if (!cfg.ok) {
    throw new Error('Email provider not configured (SES_REGION/AWS_REGION and SES_FROM_EMAIL required).')
  }

  const to = String(params.to || '').trim()
  if (!to || !to.includes('@')) throw new Error('Invalid "to" email.')

  const subject = String(params.subject || '').trim().slice(0, 998)
  const text = params.text ? String(params.text) : undefined
  const html = params.html ? String(params.html) : undefined

  // SES requires at least one body part.
  const body =
    html || text
      ? {
          ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : null),
          ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : null),
        }
      : { Text: { Data: '', Charset: 'UTF-8' } }

  const cmd = new SendEmailCommand({
    FromEmailAddress: cfg.fromEmail,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: body as any,
      },
    },
  })

  return await getClient().send(cmd)
}

