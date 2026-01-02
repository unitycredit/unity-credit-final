export const runtime = 'nodejs'

export default function Icon() {
  // Gold shield mark (matches UnityCreditLogoMark).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d4af37"/>
      <stop offset="1" stop-color="#b8860b"/>
    </linearGradient>
  </defs>
  <rect width="24" height="24" rx="6" fill="url(#g)"/>
  <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" fill="none" stroke="#0b1f3a" stroke-width="2" stroke-linejoin="round"/>
  <path d="M9.5 12l1.8 1.8L15 10" fill="none" stroke="#0b1f3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}


