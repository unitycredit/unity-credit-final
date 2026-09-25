export type GreetingMatch = {
  lang: 'yi' | 'en'
  response: string
}

function normalizeForMatch(input: string) {
  return String(input || '')
    .trim()
    .replace(/[!?,.:;"'’“”()[\]{}<>/\\|_\-]+/g, ' ')
    .replace(/[\u05f3\u05f4]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasHebrewLetters(s: string) {
  return /[א-ת]/.test(s)
}

export function maybeGreetingMatch(raw: string): GreetingMatch | null {
  const cleaned = normalizeForMatch(raw)
  if (!cleaned) return null

  // Only treat very short inputs as pure greetings to avoid swallowing real questions.
  if (cleaned.length > 40) return null

  const lower = cleaned.toLowerCase()

  const yiPatterns: RegExp[] = [
    /^(א\s+)?גוטן$/u,
    /^(א\s+)?גוטן\s+ט(?:אג|אָג)$/u,
    /^(א\s+)?גוטן\s+מארגן$/u,
    /^(א\s+)?גוטן\s+אוונט$/u,
    /^שלום$/u,
    /^העלא$/u,
    /^הי$/u,
  ]

  const enPatterns: RegExp[] = [
    /^(hi|hello|hey)$/i,
    /^good\s+(morning|afternoon|evening)$/i,
    /^greetings$/i,
  ]

  if (hasHebrewLetters(cleaned)) {
    for (const rx of yiPatterns) {
      if (rx.test(cleaned)) return { lang: 'yi', response: 'א גוטן! ווי קען איך אייך העלפֿן היינט?' }
    }
    return null
  }

  for (const rx of enPatterns) {
    if (rx.test(lower)) return { lang: 'en', response: 'Hello! How can I help you today?' }
  }

  // Common Latin transliterations used by Yiddish speakers.
  if (/^(a\s+)?gutn$/i.test(lower) || /^sholem$/i.test(lower) || /^shalom$/i.test(lower)) {
    return { lang: 'yi', response: 'א גוטן! ווי קען איך אייך העלפֿן היינט?' }
  }

  return null
}

