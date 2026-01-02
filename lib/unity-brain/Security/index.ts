// Security agent placeholder (Unity Brain).
// Intended responsibilities:
// - Risk checks / policy enforcement
// - Sensitive-data detection and redaction guidance
export type SecurityVerdict = { allow: boolean; reason?: string; risk?: 'low' | 'medium' | 'high' }


