import type { Request, Response } from 'express'
import { z } from 'zod'
import { executeUpstreamBrain } from '../brain/upstreamConnector.js'

const reqSchema = z.object({
  domain: z.enum(['savings', 'inventory', 'travel']).optional().default('savings'),
  question: z.string().min(1),
  system: z.string().min(1),
  request_id: z.string().optional(),
  disclaimer_yi: z.string().optional(),
  prefer_yiddish: z.boolean().optional(),
  require_all_nodes: z.boolean().optional(),
  category: z.string().optional(),
})

export function executeIntelligenceRoutes(app: any) {
  app.post('/v1/execute-intelligence', async (req: Request, res: Response) => {
    const parsed = reqSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors })

    const disclaimer_yi =
      String(parsed.data.disclaimer_yi || '').trim() || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.'

    const core = await executeUpstreamBrain({
      reqHost: String(req.headers.host || ''),
      domain: parsed.data.domain,
      question: parsed.data.question,
      system: parsed.data.system,
      disclaimer_yi,
      prefer_yiddish: parsed.data.prefer_yiddish,
      require_all_nodes: parsed.data.require_all_nodes,
      category: parsed.data.category,
    })

    if (!core.ok) return res.status(core.status).json({ ok: false, error: core.error, degraded: true })
    const j: any = core.json || {}
    if (!j?.ok) return res.status(core.status).json({ ok: false, blocked: Boolean(j.blocked), error: String(j.error || 'Intelligence execution failed'), details: j.details || undefined })

    return res.json({ ok: true, final: String(j.final || ''), verified: Boolean(j.verified ?? true), verification: j.verification || null })
  })
}


