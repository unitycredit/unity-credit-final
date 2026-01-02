import { z } from 'zod';
import { agentConfig } from '../../core/prompts.js';
import { executeUpstreamBrain } from '../brain/upstreamConnector.js';
export function agentRoutes(app) {
    app.get('/v1/agents', (_req, res) => {
        res.json({ ok: true, agents: agentConfig() });
    });
    const reqSchema = z.object({
        agent_id: z.string().min(1),
        question: z.string().min(1),
        language: z.enum(['en', 'yi']).optional(),
    });
    app.post('/v1/agents/execute', async (req, res) => {
        const parsed = reqSchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors });
        const agent = agentConfig().find((a) => a.id === parsed.data.agent_id);
        if (!agent)
            return res.status(404).json({ ok: false, error: 'Unknown agent_id' });
        const preferYiddish = parsed.data.language === 'yi' || /[א-ת]/.test(parsed.data.question);
        const system = `You are ${agent.role}.
Purpose: ${agent.purpose}

Rules:
- Be concise, actionable, and safe.
- Do NOT claim to access bank accounts or pull credit reports.
- If you do not know something, say so.
Response language: ${preferYiddish ? 'Yiddish (Heimishe style)' : 'English'}`;
        const core = await executeUpstreamBrain({
            reqHost: String(req.headers.host || ''),
            domain: 'savings',
            question: parsed.data.question,
            system,
            disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
            prefer_yiddish: preferYiddish,
            require_all_nodes: true,
            category: `Agent:${agent.id}`,
        });
        if (!core.ok)
            return res.status(core.status).json({ ok: false, error: core.error, degraded: true });
        const j = core.json || {};
        if (!j?.ok)
            return res.status(core.status).json({ ok: false, error: String(j?.error || 'Execution failed'), details: j?.details });
        return res.json({ ok: true, final: String(j.final || ''), verified: Boolean(j.verified ?? true), verification: j.verification || null });
    });
}
