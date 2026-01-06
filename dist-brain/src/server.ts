import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cfg } from './config.js'
import { rulesRoutes } from './routes/rules.js'
import { financeRoutes } from './routes/finance.js'
import { logicProcessRoutes } from './routes/logicProcess.js'
import { optimizeRoutes } from './routes/optimize.js'
import { professionalAdviceRoutes } from './routes/professionalAdvice.js'
import { executeIntelligenceRoutes } from './routes/executeIntelligence.js'
import { agentRoutes } from './routes/agents.js'
import { adminStatsRoutes } from './routes/adminStats.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', '..', 'public')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'dist-brain', ts: new Date().toISOString() }))
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'dist-brain', ts: new Date().toISOString() }))

// Admin Dashboard (static UI) served directly by the Brain service.
app.get('/brain-admin', (_req, res) => res.redirect(302, '/brain-admin/'))
app.use(
  '/brain-admin',
  express.static(path.join(publicDir, 'brain-admin'), {
    index: 'index.html',
    fallthrough: true,
  })
)

rulesRoutes(app)
financeRoutes(app)
logicProcessRoutes(app)
optimizeRoutes(app)
professionalAdviceRoutes(app)
executeIntelligenceRoutes(app)
agentRoutes(app)
adminStatsRoutes(app)

app.listen(cfg.port, () => {
  // eslint-disable-next-line no-console
  console.log(`dist-brain listening on port ${cfg.port}`)
})


