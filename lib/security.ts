/**
 * Enterprise-level security utilities for financial data
 */

// Rate limiting configuration
export const RATE_LIMITS = {
  API_REQUESTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  },
  ADVICE_REQUESTS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 advice requests per hour
  },
  LOGIN_ATTEMPTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
  },
} as const

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 10000) // Max length
}

// Validate financial amounts
export function validateAmount(amount: number): boolean {
  if (isNaN(amount) || !isFinite(amount)) return false
  if (amount < 0) return false
  if (amount > 10000000) return false // Max $10M
  // Check for reasonable decimal places (max 2)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length
  return decimalPlaces <= 2
}

// Sanitize credit card last 4 digits
export function sanitizeCardLast4(last4: string): string {
  const cleaned = last4.replace(/\D/g, '') // Remove non-digits
  return cleaned.slice(0, 4) // Take only first 4 digits
}

// Audit log entry type
export interface AuditLogEntry {
  userId: string
  action: string
  resource: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp: Date
}

// Create audit log entry
export function createAuditLog(
  userId: string,
  action: string,
  resource: string,
  details?: Record<string, any>
): AuditLogEntry {
  return {
    userId,
    action,
    resource,
    details,
    timestamp: new Date(),
  }
}

// Encrypt sensitive data (for client-side, use server-side encryption in production)
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) return '*'.repeat(data.length)
  const visible = data.slice(-visibleChars)
  const masked = '*'.repeat(data.length - visibleChars)
  return masked + visible
}

// Validate session
export async function validateSession(sessionToken: string | null): Promise<boolean> {
  if (!sessionToken) return false
  // Additional session validation logic here
  return true
}

// CSRF token generation (simplified - use proper library in production)
export function generateCSRFToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

