import { promptCatalog } from '../../core/prompts.js';
export function rulesRoutes(app) {
    app.get('/v1/rules/prompts', (_req, res) => {
        res.json({ ok: true, ...promptCatalog() });
    });
}
