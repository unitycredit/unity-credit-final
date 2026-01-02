import { createHmac } from 'node:crypto';
import { cfg } from '../config.js';
function hmacHex(key, message) {
    return createHmac('sha256', key).update(message).digest('hex');
}
function nowUnixSec() {
    return Math.floor(Date.now() / 1000);
}
export async function postToUpstreamBrain(params) {
    const baseUrl = String(cfg.upstreamBrainUrl || '').trim();
    const licenseKey = String(cfg.upstreamLicenseKey || '').trim();
    if (!baseUrl)
        return { ok: false, status: 503, error: 'UPSTREAM_BRAIN_API_URL is not configured.' };
    if (!licenseKey)
        return { ok: false, status: 503, error: 'UPSTREAM_BRAIN_LICENSE_KEY is not configured.' };
    const app_domain = String(cfg.unityAppDomain || params.reqHost || '').trim().toLowerCase();
    if (!app_domain)
        return { ok: false, status: 503, error: 'UNITY_APP_DOMAIN is not configured.' };
    const url = new URL(params.path, baseUrl);
    const bodyText = JSON.stringify(params.body || {});
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const ts = String(nowUnixSec());
            const sig = hmacHex(licenseKey, `${ts}.${bodyText}`);
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-unity-license-key': licenseKey,
                    'x-app-id': cfg.unityAppId,
                    'x-brain-master-token': licenseKey,
                    'x-unity-app-domain': app_domain,
                    'x-unity-ts': ts,
                    'x-unity-signature': sig,
                },
                body: bodyText,
                cache: 'no-store'
            });
            if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
                if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, attempt === 1 ? 250 : attempt === 2 ? 500 : 900));
                    continue;
                }
            }
            const json = (await resp.json().catch(() => ({})));
            return { ok: true, status: resp.status, json };
        }
        catch (e) {
            if (attempt < maxAttempts) {
                await new Promise((r) => setTimeout(r, attempt === 1 ? 250 : attempt === 2 ? 500 : 900));
                continue;
            }
            return { ok: false, status: 503, error: e?.message || 'Brain unreachable' };
        }
    }
    return { ok: false, status: 503, error: 'Brain unreachable' };
}
export async function executeUpstreamBrain(params) {
    return postToUpstreamBrain({
        reqHost: params.reqHost,
        path: '/v1/execute-intelligence',
        body: {
            domain: params.domain,
            category: params.category,
            question: params.question,
            system: params.system,
            disclaimer: params.disclaimer_yi,
            require_all_nodes: Boolean(params.require_all_nodes ?? true),
            prefer_yiddish: Boolean(params.prefer_yiddish ?? true)
        }
    });
}
