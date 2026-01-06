import { z } from 'zod';
import { promptCatalog } from '../core/prompts.js';
import { createFinanceSnapshot, computeCreditSummary } from '../core/ruleEngine.js';
import { executeUpstreamBrain } from '../src/brain/upstreamConnector.js';
import { createStorageClient } from '../storage/supabase.js';
export const creditAgentIds = ['node_1', 'node_2', 'node_3', 'node_4', 'node_5'];
export function listAgents() {
    return promptCatalog().agents;
}
const financeSnapshotReqSchema = z.object({
    cards: z.array(z.object({ limit: z.number(), balance: z.number() })).optional().nullable(),
    bank: z
        .object({
        monthly_income: z.number().nullable().optional(),
        monthly_expenses: z.number().nullable().optional(),
        total_balance: z.number().nullable().optional(),
        accounts_count: z.number().nullable().optional(),
    })
        .optional()
        .nullable(),
    budget_items: z.array(z.object({ monthly: z.union([z.number(), z.string()]).nullable().optional() })).optional().nullable(),
});
export function financeSnapshot(body) {
    const parsed = financeSnapshotReqSchema.safeParse(body || {});
    if (!parsed.success)
        return { ok: false, status: 400, json: { ok: false, error: 'Invalid payload', details: parsed.error.errors } };
    const snapshot = createFinanceSnapshot(parsed.data);
    return { ok: true, status: 200, json: { ok: true, snapshot } };
}
const logicProcessReqSchema = z.object({
    question: z.string().min(1),
    prefer_yiddish: z.boolean().optional(),
    // Optional: include credit card context so the Brain can build a unified finance snapshot.
    cards: z.array(z.object({ limit: z.number(), balance: z.number() })).optional().nullable(),
    context: z
        .object({
        disclaimer_yi: z.string().optional(),
        items: z.array(z.object({ key: z.string().optional(), yi: z.string().optional(), monthly: z.number().optional() })).optional(),
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
        .passthrough()
        .optional()
        .nullable(),
});
function hasHebrew(text) {
    return /[א-ת]/.test(text);
}
function safeTrim(v) {
    return String(v || '').trim();
}
export async function logicProcess(ctx, reqHost, body) {
    const parsed = logicProcessReqSchema.safeParse(body || {});
    if (!parsed.success)
        return { ok: false, status: 400, json: { ok: false, error: 'Invalid payload', details: parsed.error.errors } };
    const question = safeTrim(parsed.data.question);
    const c = parsed.data.context || null;
    const cards = Array.isArray(parsed.data.cards) ? parsed.data.cards : null;
    const disclaimer = safeTrim(c?.disclaimer_yi || '') || 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.';
    const preferYiddish = typeof parsed.data.prefer_yiddish === 'boolean'
        ? parsed.data.prefer_yiddish
        : hasHebrew(question) || String(process.env.UNITY_PREFER_YIDDISH || 'true') === 'true';
    const topItems = Array.isArray(c?.items) && c.items.length > 0
        ? c.items
            .filter((x) => Number(x?.monthly || 0) > 0)
            .sort((a, b) => Number(b.monthly || 0) - Number(a.monthly || 0))
            .slice(0, 12)
        : [];
    const financeSnapshot = createFinanceSnapshot({
        cards: cards && cards.length ? cards : null,
        bank: c?.bank
            ? {
                monthly_income: typeof c.bank.monthly_income === 'number' ? c.bank.monthly_income : null,
                monthly_expenses: typeof c.bank.monthly_expenses === 'number' ? c.bank.monthly_expenses : null,
                total_balance: typeof c.bank.total_balance === 'number' ? c.bank.total_balance : null,
                accounts_count: typeof c.bank.accounts_count === 'number' ? c.bank.accounts_count : null,
            }
            : null,
        budget_items: Array.isArray(c?.items) ? c.items : null,
    });
    const system = `You are Unity Credit's core engine.

You MUST:
- Give practical, conservative savings advice.
- Use the Heimishe Budget context to ground suggestions.
- Do NOT claim to pull credit reports or verify identity.
- IMPORTANT NUMERIC RULE: You are NOT allowed to do arithmetic. Do NOT compute totals, ratios, or deltas.
  - Only quote numbers that already exist in the provided finance snapshot.
  - If a user asks for a number that is not present in the finance snapshot, say you cannot compute it here.
- End your response with this exact Yiddish disclaimer line:
${disclaimer}

Finance snapshot (authoritative output from ruleEngine; treat as read-only JSON):
${JSON.stringify(financeSnapshot)}

Top budget categories (monthly; informational labels):
${topItems.map((x) => `- ${x.yi || x.key}: $${Number(x.monthly || 0).toFixed(2)}`).join('\n') || '- (none provided)'}

Response language: ${preferYiddish ? 'Yiddish (Heimishe style)' : 'English'}`;
    const core = await executeUpstreamBrain({
        reqHost,
        domain: 'savings',
        question,
        system,
        disclaimer_yi: disclaimer,
        prefer_yiddish: preferYiddish,
        require_all_nodes: true,
        category: 'Heimishe Budget',
    });
    if (!core.ok)
        return { ok: false, status: core.status, json: { ok: false, error: core.error, degraded: true } };
    const j = core.json || {};
    if (!j?.ok)
        return { ok: false, status: core.status, json: { ok: false, error: String(j?.error || 'Intelligence failed'), degraded: core.status >= 502 } };
    // Central storage (best-effort): tag by app_id and user_id (if provided by gateway later).
    try {
        const db = createStorageClient();
        if (db) {
            await db.from('unity_brain.interactions').insert({
                user_id: ctx.user_id,
                app_id: ctx.app_id,
                domain: 'savings',
                kind: 'chat',
                request_id: String(j?.request_id || ''),
                payload: { question, finance_snapshot: financeSnapshot, verification: j?.verification || null },
            });
        }
    }
    catch {
        // ignore
    }
    return {
        ok: true,
        status: 200,
        json: { ok: true, final: String(j.final || ''), verified: Boolean(j.verified ?? true), verification: j.verification || null, request_id: String(j.request_id || '') },
    };
}
const professionalAdviceReqSchema = z.object({
    question: z.string().min(1),
    cards: z.array(z.object({ limit: z.number(), balance: z.number() })).optional(),
});
export async function professionalAdvice(ctx, reqHost, body) {
    const parsed = professionalAdviceReqSchema.safeParse(body || {});
    if (!parsed.success)
        return { ok: false, status: 400, json: { ok: false, error: 'Invalid payload', details: parsed.error.errors } };
    const question = safeTrim(parsed.data.question);
    const cards = Array.isArray(parsed.data.cards) ? parsed.data.cards : [];
    const summary = cards.length ? computeCreditSummary(cards) : null;
    const context = summary
        ? `User has ${cards.length} credit card(s). Total limit: $${summary.totalLimit.toFixed(2)}, total balance: $${summary.totalBalance.toFixed(2)}, utilization: ${summary.utilizationPct.toFixed(1)}%, available: $${summary.totalAvailable.toFixed(2)}.`
        : 'No credit cards added yet.';
    const isYiddish = hasHebrew(question);
    const responseLanguage = isYiddish ? 'Yiddish (Heimishe style)' : 'English';
    const system = `You are a professional credit and financial advisor for Unity Credit.

User's current credit situation: ${context}

Guidelines:
- Be honest and transparent about credit and financial matters
- Provide specific, actionable advice
- Never provide investment advice (only credit/debt advice)
- Always respond in ${responseLanguage}`;
    const core = await executeUpstreamBrain({
        reqHost,
        domain: 'savings',
        question,
        system,
        prefer_yiddish: isYiddish,
        disclaimer_yi: 'די דאטא ווערט געהאלטן פריוואט. מיר ציען נישט קיין קרעדיט רעפארטן.',
        require_all_nodes: true,
        category: 'Professional Advice',
    });
    if (!core.ok)
        return { ok: false, status: core.status, json: { ok: false, error: core.error, degraded: true } };
    const j = core.json || {};
    if (!j?.ok)
        return { ok: false, status: core.status, json: { ok: false, error: String(j?.error || 'Advice failed'), details: j?.details } };
    return { ok: true, status: 200, json: { ok: true, final: String(j?.final || ''), verified: Boolean(j?.verified ?? true), verification: j?.verification || null } };
}
