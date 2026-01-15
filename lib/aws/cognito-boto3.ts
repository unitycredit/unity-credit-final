import 'server-only'

import path from 'node:path'
import { spawn } from 'node:child_process'

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
const DEFAULT_COGNITO_USER_POOL_ID = 'us-east-2_fJhZFZ8ms'
const DEFAULT_COGNITO_APP_CLIENT_ID = '52r69v50idofp9r4l44p3d03g9'

function scriptPath() {
  return path.join(process.cwd(), 'scripts', 'cognito_auth.py')
}

function pythonCommand(): string {
  // Allow operators to force a specific interpreter (Windows often needs `py -3`).
  // If you need arguments, set UC_PYTHON_ARGS and we’ll split them.
  return String(process.env.UC_PYTHON || process.env.PYTHON || 'python').trim() || 'python'
}

function pythonArgs(): string[] {
  const raw = String(process.env.UC_PYTHON_ARGS || '').trim()
  if (!raw) return []
  // Very small splitter: whitespace only (no quoting). Keep it simple for ops.
  return raw.split(/\s+/g).filter(Boolean)
}

export async function callCognitoBoto3<T = any>(op: CognitoBoto3Op, payload: Record<string, any>): Promise<CognitoBoto3Result<T>> {
  const region = String(process.env.AWS_COGNITO_REGION || process.env.AWS_REGION || DEFAULT_COGNITO_REGION).trim()
  const clientId = String(process.env.AWS_COGNITO_APP_CLIENT_ID || DEFAULT_COGNITO_APP_CLIENT_ID).trim()
  const userPoolId = String(process.env.AWS_COGNITO_USER_POOL_ID || DEFAULT_COGNITO_USER_POOL_ID).trim()

  const py = pythonCommand()
  const args = [...pythonArgs(), scriptPath()]

  const req = JSON.stringify({ op, payload })

  const out = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    const child = spawn(py, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AWS_COGNITO_REGION: region,
        AWS_COGNITO_APP_CLIENT_ID: clientId,
        AWS_COGNITO_USER_POOL_ID: userPoolId,
      },
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += String(d || '')))
    child.stderr.on('data', (d) => (stderr += String(d || '')))
    child.on('close', (code) => resolve({ stdout, stderr, code }))

    child.stdin.write(req)
    child.stdin.end()
  })

  // If Python couldn’t even start, we’ll usually get empty stdout.
  const raw = String(out.stdout || '').trim()
  if (!raw) {
    return {
      ok: false,
      error_code: 'cognito_boto3_failed',
      error:
        'Cognito (boto3) helper failed to run. Ensure Python is installed and `pip install boto3` is installed on the server. ' +
        (out.stderr ? `Details: ${out.stderr.slice(0, 800)}` : ''),
      status: 500,
    }
  }

  try {
    return JSON.parse(raw) as any
  } catch {
    return {
      ok: false,
      error_code: 'cognito_boto3_bad_output',
      error: `Cognito helper returned invalid JSON. stdout=${raw.slice(0, 500)} stderr=${String(out.stderr || '').slice(0, 500)}`,
      status: 500,
    }
  }
}

