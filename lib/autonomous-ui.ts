// Client-safe flags for keeping the UI usable even when backend services (Unity Brain, Supabase, etc.) are offline.
//
// Defaults:
// - Autonomous UI is ON unless explicitly disabled.
// - Brain approval gating is OFF unless explicitly enabled.

export const AUTONOMOUS_UI_ENABLED = process.env.NEXT_PUBLIC_AUTONOMOUS_MODE !== 'false'

// When enabled, some UI surfaces may display "awaiting approval" / "pending" states.
// For initial page load, this should generally remain OFF.
// Architectural pivot: Brain must never gate app access. Unity Credit owns sessions + app operation.
export const REQUIRE_BRAIN_APPROVAL_UI = false


