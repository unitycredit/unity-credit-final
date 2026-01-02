import type { Request, Response } from 'express'
import { z } from 'zod'
import { executeUpstreamBrain } from '../brain/upstreamConnector.js'

const reqSchema = z.object({
  bills: z.array(
    z.object({
      merchant: z.string(),
      category: z.string().optional().nullable(),
      occurrences: z.number().optional().nullable(),
      monthly_estimate: z.number(),
      last_date: z.string().optional().nullable(),
    })
  ),
  disclaimer_yi: z.string().optional(),
})

function extractJsonObject(text: string): any | null {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export function optimizeRoutes(app: any) {
  app.post('/v1/brain/optimize', async (req: Request, res: Response) => {
    const parsed = reqSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors })

    const bills = parsed.data.bills.slice(0, 120)
    const disclaimer_yi = String(parsed.data.disclaimer_yi || '').trim() || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.'

    const question = `Generate a Savings Optimization report from the following recurring bills snapshot.

You MUST output STRICT JSON only with keys:
{
  "recurring_bills": [{"merchant":string,"category":string,"occurrences":number,"monthly_estimate":number,"last_date":string|null}],
  "recommendations": [{"title_yi":string,"category":string|null,"merchant":string|null,"monthly_savings":number,"provider_name":string|null,"provider_url":string|null,"email_subject_yi":string|null,"email_body_yi":string|null,"target_budget_key":string|null}],
  "final": string
}

Input bills (JSON):
${JSON.stringify(bills)}
`

    const system = `You are Unity Credit's optimization engine.
- Goal: identify practical, conservative savings opportunities based on recurring bills.
- Output language: Yiddish (Heimishe style) inside the JSON fields (title_yi, email_subject_yi, email_body_yi, final).
- Do NOT ask for sensitive personal info.
- End the "final" string with this exact disclaimer line:
${disclaimer_yi}
`

    const core = await executeUpstreamBrain({
      reqHost: String(req.headers.host || ''),
      domain: 'savings',
      question,
      system,
      disclaimer_yi,
      prefer_yiddish: true,
      require_all_nodes: true,
      category: 'Recurring Bills',
    })

    if (!core.ok) return res.status(core.status).json({ ok: false, error: core.error, degraded: true })
    const j: any = core.json || {}
    if (!j?.ok) return res.status(core.status).json({ ok: false, error: String(j?.error || 'Optimization failed'), details: j?.details })

    const parsedJson = extractJsonObject(String(j?.final || ''))
    const shaped = parsedJson && typeof parsedJson === 'object' ? parsedJson : { final: String(j?.final || '') }

    return res.json({
      ok: true,
      verified: Boolean(j?.verified ?? true),
      verification: j?.verification || null,
      ...shaped,
    })
  })
}


