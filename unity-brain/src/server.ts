import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cfg } from './config.js'
import { rulesRoutes } from './routes/rules.js'
import { executeIntelligenceRoutes } from './routes/executeIntelligence.js'
import { registerBrainRouter } from '../brain-router.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, '..', 'public')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))
app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'unity-brain', ts: new Date().toISOString() }))

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
executeIntelligenceRoutes(app)
registerBrainRouter(app)

app.listen(cfg.port, () => {
  // eslint-disable-next-line no-console
  console.log(`unity-brain listening on port ${cfg.port}`)
})


