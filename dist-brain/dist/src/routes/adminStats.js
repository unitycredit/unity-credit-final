import { createStorageClient } from '../../storage/supabase.js';
export function adminStatsRoutes(app) {
    app.get('/v1/admin/stats', async (_req, res) => {
        const db = createStorageClient();
        if (!db) {
            return res.json({
                ok: true,
                warning: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
                revenue: { mrr_usd: null, arr_usd: null },
                ai_usage: { interactions_30d: null, insights_total: null },
                users: { growth_30d: null },
            });
        }
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [i30, insights] = await Promise.all([
            db
                .from('unity_brain.interactions')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', since),
            db
                .from('unity_brain.insights')
                .select('id', { count: 'exact', head: true }),
        ]);
        return res.json({
            ok: true,
            revenue: {
                // Placeholder: wire billing tables later.
                mrr_usd: 0,
                arr_usd: 0,
            },
            ai_usage: {
                interactions_30d: i30.count ?? 0,
                insights_total: insights.count ?? 0,
            },
            users: {
                // Placeholder: compute distinct users later.
                growth_30d: 0,
            },
        });
    });
}
