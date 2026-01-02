import type { Request, Response } from 'express'
import { z } from 'zod'
import { executeUpstreamBrain } from '../brain/upstreamConnector.js'
import { computeCreditSummary } from '../../core/ruleEngine.js'

const reqSchema = z.object({
  question: z.string().min(1),
  cards: z.array(z.object({ limit: z.number(), balance: z.number() })).optional(),
})

function hasHebrew(text: string) {
  return /[א-ת]/.test(text)
}

export function professionalAdviceRoutes(app: any) {
  app.post('/v1/professional-advice', async (req: Request, res: Response) => {
    const parsed = reqSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors })

    const question = String(parsed.data.question || '').trim()
    const cards = Array.isArray(parsed.data.cards) ? parsed.data.cards : []
    const summary = cards.length ? computeCreditSummary(cards as any) : null

    const context = summary
      ? `User has ${cards.length} credit card(s). Total limit: $${summary.totalLimit.toFixed(2)}, total balance: $${summary.totalBalance.toFixed(
          2
        )}, utilization: ${summary.utilizationPct.toFixed(1)}%, available: $${summary.totalAvailable.toFixed(2)}.`
      : 'No credit cards added yet.'

    const isYiddish = hasHebrew(question)
    const responseLanguage = isYiddish ? 'Yiddish (Heimishe style)' : 'English'

    const system = `You are a professional credit and financial advisor for Unity Credit.

Your role:
- Provide expert, accurate credit and financial advice
- Help users understand credit scores, credit cards, debt management, and financial planning
- Be empathetic, clear, and actionable in your responses
- Always prioritize the user's financial well-being
- If the question is in Yiddish, respond in fluent, natural Yiddish (Heimishe style)
- If the question is in English, respond in professional English
- Use the user's credit card data context to provide personalized advice

User's current credit situation: ${context}

Guidelines:
- Be honest and transparent
- Provide specific, actionable advice
- Warn about risks
- Encourage responsible credit management
- Never provide investment advice
- Always respond in ${responseLanguage}`

    const core = await executeUpstreamBrain({
      reqHost: String(req.headers.host || ''),
      domain: 'savings',
      question,
      system,
      prefer_yiddish: isYiddish,
      disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
      require_all_nodes: true,
      category: 'Professional Advice',
    })

    if (!core.ok) return res.status(core.status).json({ ok: false, error: core.error, degraded: true })
    const j: any = core.json || {}
    if (!j?.ok) return res.status(core.status).json({ ok: false, error: String(j?.error || 'Advice failed'), details: j?.details })

    return res.json({ ok: true, final: String(j?.final || ''), verified: Boolean(j?.verified ?? true), verification: j?.verification || null })
  })
}


