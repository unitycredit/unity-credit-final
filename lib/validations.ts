import { z } from "zod"

function digitsOnly(input: string) {
  return String(input || '').replace(/[^\d]/g, '')
}

// Credit Card Validation Schema
export const creditCardSchema = z.object({
  last4: z.string()
    .length(4, "Must be exactly 4 digits")
    .regex(/^\d+$/, "Must contain only numbers"),
  name: z.string()
    .min(1, "Card name is required")
    .max(100, "Card name too long"),
  // APR is optional (percent, e.g. 22.9). If omitted, UI may use a default assumption.
  apr: z.number()
    .min(0, "APR cannot be negative")
    .max(60, "APR too high")
    .optional(),
  limit: z.number()
    .positive("Limit must be positive")
    .max(10000000, "Limit too high"),
  balance: z.number()
    .min(0, "Balance cannot be negative")
    .max(10000000, "Balance too high"),
}).refine((data) => data.balance <= data.limit, {
  message: "Balance cannot exceed limit",
  path: ["balance"],
})

// User Registration Schema
export const signupSchema = z.object({
  firstName: z.string()
    .min(1, "ערשטער נאמען איז פארלאנגט")
    .max(50, "ערשטער נאמען איז צו לאנג")
    .regex(/^[a-zA-Zא-ת\s'-]+$/, "אומגילטיגע אותיות אין ערשטער נאמען"),
  lastName: z.string()
    .min(1, "לעצטער נאמען איז פארלאנגט")
    .max(50, "לעצטער נאמען איז צו לאנג")
    .regex(/^[a-zA-Zא-ת\s'-]+$/, "אומגילטיגע אותיות אין לעצטער נאמען"),
  email: z.string()
    .min(1, "אימעיל איז פארלאנגט")
    .email("אומגילטיגע אימעיל אדרעס")
    .trim()
    .toLowerCase()
    .max(255, "אימעיל איז צו לאנג")
    .refine((email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }, {
      message: "ביטע שרייב אריין א גילטיגע אימעיל אדרעס"
    }),
  phone: z.string()
    .min(1, "טעלעפאן נומער איז פארלאנגט")
    .trim()
    .max(32, "טעלעפאן נומער איז צו לאנג")
    .refine((v) => /^\+?[\d\s\-().]+$/.test(v), "אומגילטיגע טעלעפאן נומער פארמאט")
    .refine((v) => {
      const digits = digitsOnly(v)
      // Accept common US + international ranges (E.164 max is 15 digits).
      return digits.length >= 10 && digits.length <= 15
    }, "טעלעפאן נומער איז נישט גילטיג"),
  password: z.string()
    .min(8, "פאסווארט מוז זיין מינימום 8 אותיות")
    .max(128, "פאסווארט איז צו לאנג")
    .regex(/^\S+$/, "פאסווארט טאר נישט אנטהאלטן שפייס")
    .regex(/[A-Z]/, "פאסווארט מוז אנטהאלטן מינימום איין גרויס אות")
    .regex(/[a-z]/, "פאסווארט מוז אנטהאלטן מינימום איין קליין אות")
    .regex(/[0-9]/, "פאסווארט מוז אנטהאלטן מינימום איין נומער")
    .regex(/[^A-Za-z0-9]/, "פאסווארט מוז אנטהאלטן מינימום איין ספעציעלער צייכן"),
  confirmPassword: z.string().min(1, "ביטע באשטעטיגט אייער פאסווארט"),
  referralCode: z
    .string()
    .trim()
    .max(32, "Referral code is too long")
    .optional()
    .refine((v) => !v || /^[A-Za-z0-9_-]{4,32}$/.test(v), {
      message: "אומגילטיגער Referral Code",
    }),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'פאסווארטן שטימען נישט' })
  }

  const pw = String(data.password || '')
  const pwLower = pw.toLowerCase()
  const first = String(data.firstName || '').trim().toLowerCase()
  const last = String(data.lastName || '').trim().toLowerCase()
  const email = String(data.email || '').trim().toLowerCase()
  const emailLocal = email.includes('@') ? email.split('@')[0] : ''

  // Avoid trivially guessable passwords that include identity info.
  const needles = [first, last, emailLocal].filter((s) => s && s.length >= 3)
  for (const n of needles) {
    if (pwLower.includes(n)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'פאסווארט טאר נישט אנטהאלטן אייער נאמען אדער אימעיל',
      })
      break
    }
  }
})

// Login Schema
export const loginSchema = z.object({
  email: z.string()
    .min(1, "אימעיל איז פארלאנגט")
    .email("אומגילטיגע אימעיל אדרעס")
    .toLowerCase()
    .refine((email) => {
      // Additional email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    }, {
      message: "ביטע שרייב אריין א גילטיגע אימעיל אדרעס"
    }),
  password: z.string()
    .min(1, "פאסווארט איז פארלאנגט")
    .min(6, "פאסווארט מוז זיין מינימום 6 אותיות"),
})

// Login Schema (RDS / Credentials): allow either email OR username.
// Kept separate because other parts of the app still use Supabase email-only auth.
export const loginFlexibleSchema = z.object({
  email: z
    .string()
    .min(1, "אימעיל אדער באניצער־נאמען איז פארלאנגט")
    .trim()
    .refine(
      (v) => {
        const raw = String(v || '').trim()
        const lower = raw.toLowerCase()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (lower.includes('@')) return emailRegex.test(lower)
        // Username: letters/numbers plus common safe separators.
        return /^[A-Za-z0-9_.-]{2,150}$/.test(raw)
      },
      { message: "ביטע שרייב אריין א גילטיגע אימעיל אדער באניצער־נאמען" }
    ),
  password: z.string().min(1, "פאסווארט איז פארלאנגט").min(6, "פאסווארט מוז זיין מינימום 6 אותיות"),
})

// Professional advice question schema
export const adviceQuestionSchema = z.object({
  question: z.string()
    .min(1, "Question is required")
    .max(1000, "Question too long")
    .trim(),
})

export type CreditCardInput = z.infer<typeof creditCardSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type LoginFlexibleInput = z.infer<typeof loginFlexibleSchema>
export type AdviceQuestionInput = z.infer<typeof adviceQuestionSchema>

