'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Insight = {
  id: string
  merchant?: string
  amount?: number
  advice?: string
  /** Preferred display field when Brain provides explicit Yiddish advice text. */
  yiddish_advice?: string
  created_at: string
  source: 'brain'
  raw?: any
}

type InsightBus = {
  /** All insights persisted locally. UI renders what Brain sends. */
  insights: Insight[]
  /** Ingest a raw message from Brain (UI must not apply business rules). */
  ingestBrainMessage: (msg: any) => void
  /** Clear persisted insights (dev). */
  clear: () => void
}

const Ctx = createContext<InsightBus | null>(null)

const STORAGE_KEY = 'uc_insights_v1'
const MAX_ITEMS = 75

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function safeUpper(v: any) {
  return String(v || '').trim().toUpperCase()
}

function safeTrim(v: any) {
  return String(v || '').trim()
}

function toFiniteNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function InsightBusProvider({ children }: { children: React.ReactNode }) {
  const [insights, setInsights] = useState<Insight[]>([])

  // Load persisted insights (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || ''
      const parsed = raw ? safeJsonParse(raw) : null
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .filter((x) => x && typeof x === 'object')
          .slice(0, MAX_ITEMS) as Insight[]
        setInsights(sanitized)
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist to localStorage (Unity Credit owns state; Brain is stateless for app state).
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(insights.slice(0, MAX_ITEMS)))
    } catch {
      // ignore
    }
  }, [insights])

  const ingestBrainMessage = useCallback((msg: any) => {
    if (!msg) return
    const payload = (msg as any)?.payload ?? (msg as any)?.data ?? msg

    // Ignore our own handshake ping or trivial keepalives.
    const kindUpper = safeUpper((msg as any)?.kind || (payload as any)?.kind || (payload as any)?.event)
    if (kindUpper === 'HELLO' || kindUpper === 'PING' || kindUpper === 'PONG') return

    // Primary contract: explicit INSIGHT messages.
    const topTypeUpper = safeUpper((msg as any)?.type || (msg as any)?.kind || (payload as any)?.type || (payload as any)?.kind)

    // Fallback contract: if Brain sends a direct "insight card" object (common in WS streams),
    // accept it even if `type !== INSIGHT` so the UI can render the card immediately.
    const looksLikeInsightCard =
      payload &&
      typeof payload === 'object' &&
      (Boolean((payload as any)?.merchant) ||
        Boolean((payload as any)?.title_yi) ||
        Boolean((payload as any)?.title) ||
        Boolean((payload as any)?.provider_name) ||
        Boolean((payload as any)?.monthly_savings) ||
        Boolean((payload as any)?.savings_amount) ||
        Boolean((payload as any)?.amount) ||
        Boolean((payload as any)?.advice) ||
        Boolean((payload as any)?.advice_text) ||
        Boolean((payload as any)?.email_body_yi) ||
        Boolean((payload as any)?.final) ||
        Boolean((payload as any)?.text) ||
        Boolean((payload as any)?.message) ||
        Boolean((payload as any)?.recommendation))

    if (topTypeUpper !== 'INSIGHT' && !looksLikeInsightCard) return

    const merchant =
      safeTrim((payload as any)?.merchant) ||
      safeTrim((payload as any)?.title_yi) ||
      safeTrim((payload as any)?.title) ||
      safeTrim((payload as any)?.provider_name) ||
      undefined

    const amount =
      toFiniteNumber(
        (payload as any)?.amount ??
          (payload as any)?.savings_amount ??
          (payload as any)?.monthly_savings ??
          (payload as any)?.monthlySavings ??
          (payload as any)?.savingsAmount
      ) ?? undefined

    const yiddishAdviceRaw =
      (payload as any)?.yiddish_advice ??
      (payload as any)?.advice_yi ??
      (payload as any)?.yiddishAdvice ??
      (payload as any)?.adviceYi ??
      null
    const yiddish_advice = yiddishAdviceRaw ? safeTrim(yiddishAdviceRaw) : undefined

    const adviceRaw =
      (payload as any)?.advice ??
      (payload as any)?.advice_text ??
      (payload as any)?.email_body_yi ??
      (payload as any)?.final ??
      (payload as any)?.text ??
      (payload as any)?.message ??
      (payload as any)?.recommendation ??
      null
    // Prefer the explicit yiddish_advice field if present (per UI requirement).
    const advice = yiddish_advice || (adviceRaw ? safeTrim(adviceRaw) : undefined)

    const id = makeId('insight')
    const created_at = safeTrim((payload as any)?.created_at || (msg as any)?.created_at) || nowIso()

    const next: Insight = { id, merchant, amount, advice, yiddish_advice, created_at, source: 'brain', raw: payload }
    setInsights((prev) => [next, ...prev].slice(0, MAX_ITEMS))
  }, [])

  const clear = useCallback(() => {
    setInsights([])
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo<InsightBus>(
    () => ({ insights, ingestBrainMessage, clear }),
    [insights, ingestBrainMessage, clear]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInsightBus() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useInsightBus must be used within InsightBusProvider')
  return ctx
}


