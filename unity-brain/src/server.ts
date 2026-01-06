import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { cfg } from './config.js'
import { rulesRoutes } from './routes/rules.js'
import { executeIntelligenceRoutes } from './routes/executeIntelligence.js'
import { registerBrainRouter } from '../brain-router.js'

// In App Runner / Docker we start from the service directory (e.g. `cd unity-brain && npm start`),
// so `process.cwd()` points at the service root. This makes static asset paths stable across TS builds.
const publicDir = path.join(process.cwd(), 'public')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))

// Admin Dashboard (static UI) served directly by the Brain service.
app.use(
  '/brain-admin',
  express.static(path.join(publicDir, 'brain-admin'), {
    index: 'index.html',
    fallthrough: true,
  })
)

rulesRoutes(app)
executeIntelligenceRoutes(app)
registerBrainRouter(app)

app.listen(cfg.port, () => {
  // eslint-disable-next-line no-console
  console.log(`unity-brain listening on port ${cfg.port}`)
})


