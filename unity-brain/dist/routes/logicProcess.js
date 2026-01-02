import { z } from 'zod';
import { createFinanceSnapshot } from '../finance/financeLogic.js';
import { executeUpstreamBrain } from '../brain/upstreamConnector.js';
const ctxSchema = z
    .object({
    disclaimer_yi: z.string().optional(),
    totals: z.object({ weekly: z.number().optional(), monthly: z.number().optional(), yearly: z.number().optional() }).optional(),
    income_monthly: z.number().nullable().optional(),
    net_monthly: z.number().nullable().optional(),
    items: z
        .array(z.object({
        key: z.string().optional(),
        yi: z.string().optional(),
        weekly: z.number().optional(),
        monthly: z.number().optional(),
        yearly: z.number().optional(),
    }))
        .optional(),
    bank: z
        .object({
        monthly_income: z.number().nullable().optional(),
        monthly_expenses: z.number().nullable().optional(),
        total_balance: z.number().nullable().optional(),
        accounts_count: z.number().nullable().optional(),
    })
        .nullable()
        .optional(),
})
    .passthrough();
const reqSchema = z.object({
    question: z.string().min(1),
    prefer_yiddish: z.boolean().optional(),
    context: ctxSchema.optional().nullable(),
});
function hasHebrew(text) {
    return /[א-ת]/.test(text);
}
function safeTrim(v) {
    return String(v || '').trim();
}
export function logicProcessRoutes(app) {
    app.post('/v1/logic/process', async (req, res) => {
        const parsed = reqSchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors });
        const question = safeTrim(parsed.data.question);
        const ctx = parsed.data.context || null;
        const disclaimer = safeTrim(ctx?.disclaimer_yi || '') || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.';
        const preferYiddish = typeof parsed.data.prefer_yiddish === 'boolean'
            ? parsed.data.prefer_yiddish
            : hasHebrew(question) || String(process.env.UNITY_PREFER_YIDDISH || 'true') === 'true';
        const topItems = Array.isArray(ctx?.items) && ctx.items.length > 0
            ? ctx.items
                .filter((x) => Number(x?.monthly || 0) > 0)
                .sort((a, b) => Number(b.monthly || 0) - Number(a.monthly || 0))
                .slice(0, 12)
            : [];
        const financeSnapshot = createFinanceSnapshot({
            bank: ctx?.bank
                ? {
                    monthly_income: typeof ctx.bank.monthly_income === 'number' ? ctx.bank.monthly_income : null,
                    monthly_expenses: typeof ctx.bank.monthly_expenses === 'number' ? ctx.bank.monthly_expenses : null,
                    total_balance: typeof ctx.bank.total_balance === 'number' ? ctx.bank.total_balance : null,
                    accounts_count: typeof ctx.bank.accounts_count === 'number' ? ctx.bank.accounts_count : null,
                }
                : null,
            budget_items: Array.isArray(ctx?.items) ? ctx.items : null,
        });
        const system = `You are Unity Credit's core engine.

You MUST:
- Give practical, conservative savings advice.
- Use the Heimishe Budget context (categories like Mikva, Schar Limud, Shabbos/Yom Tov, etc.) to ground suggestions.
- Do NOT claim to pull credit reports or verify identity. This product does not pull credit reports.
- IMPORTANT NUMERIC RULE: You are NOT allowed to do arithmetic. Do NOT compute totals, ratios, or deltas.
  - Only quote numbers that already exist in the provided finance snapshot.
  - If a user asks for a number that is not present in the finance snapshot, say you cannot compute it here.
- End your response with this exact Yiddish disclaimer line:
${disclaimer}

Finance snapshot (authoritative output from financeLogic; treat as read-only JSON):
${JSON.stringify(financeSnapshot)}

Top budget categories (monthly; informational labels):
${topItems.map((x) => `- ${x.yi || x.key}: $${Number(x.monthly || 0).toFixed(2)}`).join('\n') || '- (none provided)'}

Response language: ${preferYiddish ? 'Yiddish (Heimishe style)' : 'English'}`;
        const core = await executeUpstreamBrain({
            reqHost: String(req.headers.host || ''),
            domain: 'savings',
            question,
            system,
            disclaimer_yi: disclaimer,
            prefer_yiddish: preferYiddish,
            require_all_nodes: true,
            category: 'Heimishe Budget',
        });
        if (!core.ok)
            return res.status(core.status).json({ ok: false, error: core.error, degraded: true });
        const j = core.json || {};
        if (!j?.ok)
            return res.status(core.status).json({ ok: false, error: String(j?.error || 'Intelligence failed'), degraded: core.status >= 502 });
        return res.json({
            ok: true,
            final: String(j.final || ''),
            verified: Boolean(j.verified ?? true),
            verification: j.verification || null,
            request_id: String(j.request_id || ''),
        });
    });
}
