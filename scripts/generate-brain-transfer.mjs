import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = process.cwd()

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function readFileSafe(relPath) {
  const abs = path.join(ROOT, relPath)
  try {
    const buf = await fs.readFile(abs)
    const content = buf.toString('utf8')
    return {
      path: relPath,
      bytes: buf.length,
      sha256: sha256(content),
      content,
    }
  } catch (e) {
    return null
  }
}

async function main() {
  const includeFiles = [
    // Canonical brain prompts + rules
    'unity-brain/core/prompts.ts',
    'unity-brain/core/ruleEngine.ts',
    'unity-brain/brain-router.ts',
    'unity-brain/modules/credit-module.ts',
    'unity-brain/modules/registry.ts',
    'unity-brain/storage/supabase.ts',
    'unity-brain/storage/UNITY_BRAIN_GLOBAL_SCHEMA.sql',

    // Unity Credit -> Brain proxies + handshake
    'lib/unity-brain-office.ts',
    'app/api/finance/snapshot/route.ts',
    'app/api/logic/process/route.ts',
    'app/api/brain/optimize/route.ts',
    'app/api/professional-advice/route.ts',
    'app/api/unity-brain/v1/route.ts',

    // Database schemas/indexes used by Unity Credit (operational continuity)
    'SUPABASE_DASHBOARD_SCALING_INDEXES.sql',
    'SUPABASE_PLAID_TRANSACTIONS.sql',
    'SUPABASE_USER_SAVINGS.sql',
    'SUPABASE_RLS_GUARDRAILS.sql',
    'supabase-plaid-tokens-migration.sql',

    // Env wiring reference
    'env.example',
  ]

  const files = (await Promise.all(includeFiles.map(readFileSafe))).filter(Boolean)

  const exportObj = {
    version: 1,
    generated_at: new Date().toISOString(),
    source_workspace: ROOT,
    proxy_target_ready_url: 'http://unitybrein-env.eba-3bzvyngj.us-east-2.elasticbeanstalk.com',
    handshake: {
      required_headers: {
        'x-app-id': '<your-app-id>',
        'App-Key': '<shared-secret>',
      },
      unity_credit_env: {
        UNITY_BRAIN_OFFICE_URL: 'http://unitybrein-env.eba-3bzvyngj.us-east-2.elasticbeanstalk.com',
        UNITY_CREDIT_APP_ID: 'unity-credit',
        UNITY_CREDIT_APP_KEY: 'change-me',
      },
      unity_brain_env: {
        UNITY_BRAIN_APP_KEYS_JSON: '{"unity-credit":"change-me"}',
      },
    },
    api_contract: {
      router: {
        endpoint: '/v1/router',
        method: 'POST',
        actions: ['finance.snapshot', 'logic.process', 'professional-advice'],
        payload_shape: { action: 'string', payload: 'any' },
      },
      convenience_endpoints: [
        { method: 'POST', path: '/v1/finance/snapshot' },
        { method: 'POST', path: '/v1/logic/process' },
        { method: 'POST', path: '/v1/professional-advice' },
        { method: 'GET', path: '/v1/agents' },
      ],
      upstream_ai: {
        description: 'Unity Brain calls the upstream AI service via HMAC-signed requests.',
        endpoint: '/v1/execute-intelligence (upstream)',
      },
    },
    included_files: files,
  }

  const outPath = path.join(ROOT, 'brain_transfer.json')
  await fs.writeFile(outPath, JSON.stringify(exportObj, null, 2), 'utf8')

  // eslint-disable-next-line no-console
  console.log(`Wrote brain_transfer.json with ${files.length} files`)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})


