import { z } from 'zod';
import { resolveModule } from './modules/registry.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
function safeTrim(v) {
    return String(v || '').trim();
}
function readHeader(req, name) {
    const v = req.headers?.[name] || req.headers?.[name.toLowerCase()];
    return safeTrim(Array.isArray(v) ? v[0] : v);
}
function parseAppKeysFromEnv() {
    const raw = safeTrim(process.env.UNITY_BRAIN_APP_KEYS_JSON || '');
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return {};
        const out = {};
        for (const [k, v] of Object.entries(parsed)) {
            const kk = safeTrim(k).toLowerCase();
            const vv = safeTrim(v);
            if (kk && vv)
                out[kk] = vv;
        }
        return out;
    }
    catch {
        return {};
    }
}
function verifyApp(req) {
    const app_id = readHeader(req, 'x-app-id') || readHeader(req, 'app-id') || 'unknown';
    const provided = readHeader(req, 'app-key') || readHeader(req, 'x-app-key');
    const keys = parseAppKeysFromEnv();
    const expected = keys[String(app_id).toLowerCase()] || '';
    // If no keys configured, fail closed in production; allow in dev for bootstrap.
    const isProd = process.env.NODE_ENV === 'production';
    if (!expected) {
        if (isProd)
            return { ok: false, app_id, error: 'Unity Brain is missing app-key configuration (UNITY_BRAIN_APP_KEYS_JSON).' };
        return { ok: true, app_id };
    }
    if (!provided)
        return { ok: false, app_id, error: 'Missing App-Key header.' };
    if (provided !== expected)
        return { ok: false, app_id, error: 'Invalid App-Key.' };
    return { ok: true, app_id };
}
const routerReqSchema = z.object({
    action: z.string().min(1),
    payload: z.any().optional(),
});
export function registerBrainRouter(app) {
    // Universal router endpoint (module/agent dispatch). Works for any calling domain/app.
    app.post('/v1/router', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const parsed = routerReqSchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors });
        const { mod } = resolveModule(auth.app_id);
        const reqHost = readHeader(req, 'host');
        const ctx = { app_id: auth.app_id, user_id: null };
        const action = parsed.data.action;
        const payload = parsed.data.payload;
        if (action === 'finance.snapshot')
            return res.json(mod.financeSnapshot(payload).json);
        if (action === 'logic.process') {
            const out = await mod.logicProcess(ctx, reqHost, payload);
            return res.status(out.status).json(out.json);
        }
        // Dashboard-friendly alias: analyze → core logic.process
        if (action === 'analyze') {
            const out = await mod.logicProcess(ctx, reqHost, payload);
            return res.status(out.status).json(out.json);
        }
        if (action === 'professional-advice') {
            const out = await mod.professionalAdvice(ctx, reqHost, payload);
            return res.status(out.status).json(out.json);
        }
        // Back-compat / dashboard naming: analyst_agent → professional advice module.
        if (action === 'analyst_agent') {
            const out = await mod.professionalAdvice(ctx, reqHost, payload);
            return res.status(out.status).json(out.json);
        }
        return res.status(404).json({ ok: false, error: 'Unknown action' });
    });
    // Convenience endpoints (thin wrappers around /v1/router for common Unity Credit calls)
    app.post('/v1/finance/snapshot', (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = mod.financeSnapshot(req.body);
        return res.status(out.status).json(out.json);
    });
    app.post('/v1/logic/process', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = await mod.logicProcess({ app_id: auth.app_id, user_id: null }, readHeader(req, 'host'), req.body);
        return res.status(out.status).json(out.json);
    });
    // Dashboard endpoint: /v1/analyze (alias of /v1/logic/process).
    app.post('/v1/analyze', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = await mod.logicProcess({ app_id: auth.app_id, user_id: null }, readHeader(req, 'host'), req.body);
        return res.status(out.status).json(out.json);
    });
    app.post('/v1/professional-advice', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = await mod.professionalAdvice({ app_id: auth.app_id, user_id: null }, readHeader(req, 'host'), req.body);
        return res.status(out.status).json(out.json);
    });
    // Convenience: stable dashboard endpoint (maps to professional advice).
    app.post('/v1/analyst-agent', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = await mod.professionalAdvice({ app_id: auth.app_id, user_id: null }, readHeader(req, 'host'), req.body);
        return res.status(out.status).json(out.json);
    });
    // Central subscription logic (Stripe-backed via REST API) for Pro gating.
    // Payload: { user_id: string }
    app.post('/v1/subscription/status', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const stripeKey = safeTrim(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || '');
        if (!stripeKey)
            return res.status(503).json({ ok: false, error: 'Stripe is not configured on Brain (STRIPE_SECRET_KEY).' });
        const user_id = safeTrim(req.body?.user_id || '');
        if (!user_id)
            return res.status(400).json({ ok: false, error: 'Missing user_id' });
        async function stripePost(path, body) {
            const r = await fetch(`https://api.stripe.com${path}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${stripeKey}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            });
            const j = await r.json().catch(() => ({}));
            return { ok: r.ok, status: r.status, json: j };
        }
        async function stripeGet(path) {
            const r = await fetch(`https://api.stripe.com${path}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${stripeKey}` },
            });
            const j = await r.json().catch(() => ({}));
            return { ok: r.ok, status: r.status, json: j };
        }
        // Find customer by user_id metadata (UnityCredit checkout sets this).
        const q = `metadata['user_id']:'${user_id}'`;
        const search = await stripePost('/v1/customers/search', new URLSearchParams({ query: q, limit: '1' }));
        const customerId = String(search?.json?.data?.[0]?.id || '').trim();
        if (!customerId) {
            return res.json({ ok: true, tier: 'free', premium_until: null, trial_until: null, source: 'brain_stripe' });
        }
        const subs = await stripeGet(`/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`);
        const active = Array.isArray(subs?.json?.data) ? subs.json.data.find((x) => x?.status === 'active' || x?.status === 'trialing') : null;
        if (!active) {
            return res.json({ ok: true, tier: 'free', premium_until: null, trial_until: null, source: 'brain_stripe' });
        }
        const periodEnd = Number(active?.current_period_end || 0);
        const until = Number.isFinite(periodEnd) && periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null;
        return res.json({
            ok: true,
            tier: 'pro',
            premium_until: until,
            trial_until: active?.status === 'trialing' ? until : null,
            source: 'brain_stripe',
        });
    });
    app.get('/v1/agents', (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        return res.json({ ok: true, agents: mod.listAgents() });
    });
    // Admin inbox: Support messages from Unity Credit (no chat; only forwards user questions for admins).
    const supportSchema = z.object({
        type: z.string().optional(),
        user_id: z.string().min(1).optional().nullable(),
        email: z.string().optional().nullable(),
        subject: z.string().optional().nullable(),
        message: z.string().min(3),
        created_at: z.string().optional().nullable(),
    });
    async function acceptSupportTicket(req, res) {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const parsed = supportSchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors });
        const ticket_id = `sup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const row = {
            ticket_id,
            received_at: new Date().toISOString(),
            app_id: auth.app_id,
            user_id: parsed.data.user_id || null,
            email: parsed.data.email || null,
            subject: parsed.data.subject || null,
            message: String(parsed.data.message || '').slice(0, 4000),
            meta: { type: parsed.data.type || 'SUPPORT_MESSAGE', created_at: parsed.data.created_at || null },
        };
        // Best-effort local persistence for Brain Admin panel tooling (dev-friendly).
        try {
            const dataDir = path.join(process.cwd(), '.data');
            const filePath = path.join(dataDir, 'support_inbox.json');
            await fs.mkdir(dataDir, { recursive: true });
            let existing = [];
            try {
                const raw = await fs.readFile(filePath, 'utf8');
                const j = JSON.parse(raw);
                if (Array.isArray(j))
                    existing = j;
            }
            catch {
                existing = [];
            }
            existing.unshift(row);
            await fs.writeFile(filePath, JSON.stringify(existing.slice(0, 500), null, 2), 'utf8');
        }
        catch {
            // ignore
        }
        // eslint-disable-next-line no-console
        console.log(`[support_ticket] ${row.ticket_id} user=${row.user_id || 'unknown'} subject=${String(row.subject || '').slice(0, 80)}`);
        return res.json({ ok: true, ticket_id });
    }
    // Requested endpoint (Brain admin panel inbox):
    app.post('/admin/support-tickets', acceptSupportTicket);
    // Back-compat alias (older Unity Credit builds):
    app.post('/v1/admin/support/inbox', acceptSupportTicket);
}
