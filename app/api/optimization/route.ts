export const runtime = 'nodejs'

// Compatibility route:
// Older clients hit `/api/optimization` directly.
// - GET should return the latest cached snapshot
// - POST should trigger a server-side run (admin/worker only)
export { GET } from './latest/route'
export { POST } from './run/route'


