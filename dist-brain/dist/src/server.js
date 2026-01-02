import express from 'express';
import cors from 'cors';
import { cfg } from './config.js';
import { rulesRoutes } from './routes/rules.js';
import { financeRoutes } from './routes/finance.js';
import { logicProcessRoutes } from './routes/logicProcess.js';
import { optimizeRoutes } from './routes/optimize.js';
import { professionalAdviceRoutes } from './routes/professionalAdvice.js';
import { executeIntelligenceRoutes } from './routes/executeIntelligence.js';
import { agentRoutes } from './routes/agents.js';
import { adminStatsRoutes } from './routes/adminStats.js';
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'dist-brain', ts: new Date().toISOString() }));
rulesRoutes(app);
financeRoutes(app);
logicProcessRoutes(app);
optimizeRoutes(app);
professionalAdviceRoutes(app);
executeIntelligenceRoutes(app);
agentRoutes(app);
adminStatsRoutes(app);
app.listen(cfg.port, () => {
    // eslint-disable-next-line no-console
    console.log(`dist-brain listening on http://localhost:${cfg.port}`);
});
