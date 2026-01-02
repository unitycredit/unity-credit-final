import type { Request, Response } from 'express'
import { promptCatalog } from '../../core/prompts.js'

export function rulesRoutes(app: any) {
  app.get('/v1/rules/prompts', (_req: Request, res: Response) => {
    res.json({ ok: true, ...promptCatalog() })
  })
}


