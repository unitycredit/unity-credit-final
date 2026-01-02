import 'server-only'
import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Centralized path resolver for server-side file storage.
 *
 * In the "external architecture" (multiple repos/services), `process.cwd()` can vary
 * depending on how/where the server is started. Allow an explicit override.
 */
export function getDataDir() {
  const override = String(process.env.UNITYCREDIT_DATA_DIR || '').trim()
  if (override) return path.resolve(override)
  return path.join(process.cwd(), '.data')
}

export function dataPath(...parts: string[]) {
  return path.join(getDataDir(), ...parts)
}

export async function ensureDataDir() {
  await fs.mkdir(getDataDir(), { recursive: true })
}


