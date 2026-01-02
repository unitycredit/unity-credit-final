// Purifier agent placeholder (Unity Brain).
// Intended responsibilities:
// - Output sanitation/normalization before returning to end users
// - Ensure no internal architecture/vendor details leak
export type PurifiedText = { text: string; redactions?: number }


