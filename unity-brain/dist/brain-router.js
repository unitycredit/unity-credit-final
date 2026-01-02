import { z } from 'zod';
import { resolveModule } from './modules/registry.js';
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
        if (action === 'professional-advice') {
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
    app.post('/v1/professional-advice', async (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        const out = await mod.professionalAdvice({ app_id: auth.app_id, user_id: null }, readHeader(req, 'host'), req.body);
        return res.status(out.status).json(out.json);
    });
    app.get('/v1/agents', (req, res) => {
        const auth = verifyApp(req);
        if (!auth.ok)
            return res.status(401).json({ ok: false, error: auth.error || 'Unauthorized', app_id: auth.app_id });
        const { mod } = resolveModule(auth.app_id);
        return res.json({ ok: true, agents: mod.listAgents() });
    });
}
