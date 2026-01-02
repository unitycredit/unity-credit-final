import { z } from 'zod';
import { createFinanceSnapshot } from '../../core/ruleEngine.js';
const snapshotReqSchema = z.object({
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
export function financeRoutes(app) {
    app.post('/v1/finance/snapshot', (req, res) => {
        const parsed = snapshotReqSchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.errors });
        const s = createFinanceSnapshot(parsed.data);
        return res.json({ ok: true, snapshot: s });
    });
}
