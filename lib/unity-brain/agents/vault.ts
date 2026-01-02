// Canonical vault facade for Unity Brain agents (server-only).
//
// NOTE: Do not import this module into Client Components or Edge runtime bundles.
import 'server-only'

export type { EncBlob } from '@/lib/vault-crypto'
export { vaultEncryptionEnabled, encryptJson, decryptJson, encryptBytes, decryptBytes } from '@/lib/vault-crypto'

export type { VaultKind, VaultCategory, VaultRow, VaultAdvicePayload } from '@/lib/unity-savings-vault'
export { vaultReady, encryptPayload, decryptPayload, findVaultAdviceBatch, upsertVaultAdvice } from '@/lib/unity-savings-vault'


