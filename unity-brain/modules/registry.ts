import * as credit from './credit-module.js'

export type BrainModuleId = 'unity-credit'

export function resolveModule(app_id: string) {
  // Future expansion: map many app_ids to modules.
  if (String(app_id || '').trim().toLowerCase() === 'unity-credit') return { id: 'unity-credit' as const, mod: credit }
  // Default (safe): treat unknown app as unity-credit for now, but keep id explicit.
  return { id: 'unity-credit' as const, mod: credit }
}


