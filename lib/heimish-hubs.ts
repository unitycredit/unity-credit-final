export type HeimishHubKey = 'bingo_wholesale' | 'evergreen' | 'rockland_kosher' | 'npgs' | 'pomegranate' | 'seasons'

export type HeimishHub = {
  key: HeimishHubKey
  label: string
  aliases: string[]
}

export const HEIMISH_HUBS: HeimishHub[] = [
  {
    key: 'bingo_wholesale',
    label: 'Bingo Wholesale',
    aliases: ['bingo wholesale', 'bingo', 'bingo cash & carry', 'bingo cash and carry'],
  },
  {
    key: 'evergreen',
    label: 'Evergreen',
    aliases: ['evergreen', 'evergreen kosher', 'evergreen market'],
  },
  {
    key: 'rockland_kosher',
    label: 'Rockland Kosher',
    aliases: ['rockland kosher', 'rockland kosher supermarket', 'rockland kosher super', 'rk kosher'],
  },
  {
    key: 'npgs',
    label: 'NPGS',
    aliases: ['npgs'],
  },
  {
    key: 'pomegranate',
    label: 'Pomegranate',
    aliases: ['pomegranate', 'pomegranate supermarket'],
  },
  {
    key: 'seasons',
    label: 'Seasons',
    aliases: ['seasons', 'seasons kosher', 'seasons supermarket', 'seasons market'],
  },
]

function norm(s: string) {
  return String(s || '')
    .toLowerCase()
    // Avoid unicode property escapes for maximum runtime compatibility.
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, ' ')
    .trim()
}

/**
 * Deterministic mapping for Plaid merchants → Heimish hubs.
 * Returns null if no match.
 */
export function mapHeimishHub(input: string): HeimishHub | null {
  const t = norm(input)
  if (!t) return null
  for (const hub of HEIMISH_HUBS) {
    for (const a of hub.aliases) {
      const aa = norm(a)
      if (aa && t.includes(aa)) return hub
    }
  }
  return null
}


