import express from 'express'
import cors from 'cors'
import { cfg } from './config.js'
import { rulesRoutes } from './routes/rules.js'
import { executeIntelligenceRoutes } from './routes/executeIntelligence.js'
import { registerBrainRouter } from '../brain-router.js'

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))

rulesRoutes(app)
executeIntelligenceRoutes(app)
registerBrainRouter(app)

app.listen(cfg.port, () => {
  // eslint-disable-next-line no-console
  console.log(`unity-brain listening on port ${cfg.port}`)
})


