export function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/+$/, '')

  // Common hosted environments
  const vercel = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  if (vercel) return `https://${vercel}`.replace(/\/+$/, '')

  const cfPages = process.env.CF_PAGES_URL
  if (cfPages) return cfPages.replace(/\/+$/, '')

  // Safe fallback (prevents build-time crashes when metadata is evaluated without deployment env vars).
  // For production, you should still set NEXT_PUBLIC_APP_URL for correct canonical URLs.
  return 'http://localhost:3000'
}


