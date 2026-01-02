export function devGuestModeAllowed() {
  // Explicitly dev-only: never allow guest auth bypass in production.
  return process.env.NEXT_PUBLIC_DEV_GUEST_MODE === 'true' && process.env.NODE_ENV !== 'production'
}


