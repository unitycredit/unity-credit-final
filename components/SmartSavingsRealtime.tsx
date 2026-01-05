'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BadgeCheck, Brain, Radio, Sparkles, Zap } from 'lucide-react'
import { useInsightBus } from '@/components/InsightBusProvider'
import { useI18n } from '@/components/LanguageProvider'

type InsightItem = {
  id: string
  merchant?: string
  amount?: number
  advice?: string
  created_at: string
  raw?: any
}

function safeJsonParse(input: any) {
  try {
    return JSON.parse(String(input || ''))
  } catch {
    return null
  }
}

function nowIso() {
  return new Date().toISOString()
}

function toNumber(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function SmartSavingsRealtime() {
  const { lang } = useI18n()
  const { insights, ingestBrainMessage } = useInsightBus()
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [brainReachable, setBrainReachable] = useState<boolean>(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<any>(null)
  const [pulseAmount, setPulseAmount] = useState(false)
  const prevPotentialRef = useRef<number | null>(null)

  const wsCandidates = useMemo(() => {
    if (typeof window === 'undefined') return []
    // Fixed path requirement: ONLY connect to this endpoint (no fallbacks).
    return [process.env.NEXT_PUBLIC_UNITY_BRAIN_WS_URL || 'ws://unitybrein-env.eba-3bzvyngj.us-east-2.elasticbeanstalk.com/ws']
  }, [])

  // Unity Credit owns display logic; we forward raw Brain messages into the Insight Bus.
  function dispatchMessage(msg: any) {
    // Generic receiver: store only explicit INSIGHT messages.
    ingestBrainMessage(msg)
  }

  function cleanupWs() {
    try {
      wsRef.current?.close()
    } catch {
      // ignore
    }
    wsRef.current = null
    setConnected(false)
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return
    // Fixed retry delay (requirement): 5 seconds.
    const delay = 5000
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      connect()
    }, delay)
  }

  function connect() {
    if (typeof window === 'undefined') return
    if (!wsCandidates.length) return
    cleanupWs()

    const url = wsCandidates[0]
    setConnecting(true)

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnecting(false)
        try {
          ws.send(JSON.stringify({ kind: 'hello', app: 'unity-credit', ts: nowIso() }))
        } catch {
          // ignore
        }
      }

      ws.onmessage = (ev) => {
        const parsed = typeof ev?.data === 'string' ? safeJsonParse(ev.data) : null
        // Debug Mode: print every message received from Brain.
        // eslint-disable-next-line no-console
        console.log('[unity-brain][ws][message]', { raw: ev?.data, parsed })
        dispatchMessage(parsed ?? ev?.data)
      }

      ws.onerror = () => {
        // browser will also trigger onclose; keep minimal handling here
      }

      ws.onclose = () => {
        setConnected(false)
        setConnecting(true)
        // rotate endpoint candidate each failure
        scheduleReconnect()
      }
    } catch {
      setConnected(false)
      setConnecting(true)
      scheduleReconnect()
    }
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
      cleanupWs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsCandidates.join('|')])

  // Brain reachability probe (via Unity Credit proxy) — informational only.
  // We **do not** use this to disconnect WS; the WS connection itself is the authoritative signal.
  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        // Probe via our own Next.js API route (avoids CORS + keeps backend URL server-side).
        const res = await fetch('/api/brain/health', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        const ok = Boolean((json as any)?.ok)
        if (cancelled) return
        setBrainReachable(ok)
      } catch {
        if (cancelled) return
        setBrainReachable(false)
      }
    }
    tick()
    const id = window.setInterval(tick, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const liveInsights = (Array.isArray(insights) ? insights : []).slice(0, 25) as any[]
  const latestInsight = liveInsights.length ? (liveInsights[0] as any) : null
  const hasInsights = Boolean(liveInsights.length)
  const livePotentialMonthly = useMemo(() => {
    let sum = 0
    for (const it of liveInsights) {
      const n = toNumber(it?.amount)
      if (typeof n === 'number' && n > 0) sum += n
    }
    return sum
  }, [liveInsights])

  // Subtle "live" pulse when the dollar amount changes (one-shot).
  useEffect(() => {
    const prev = prevPotentialRef.current
    prevPotentialRef.current = livePotentialMonthly
    if (prev === null) return
    if (Math.round(prev) === Math.round(livePotentialMonthly)) return
    setPulseAmount(true)
    const id = window.setTimeout(() => setPulseAmount(false), 900)
    return () => window.clearTimeout(id)
  }, [livePotentialMonthly])

  const statusText = connected
    ? lang === 'yi'
      ? 'פֿאַרבונדן מיט Unity Brain'
      : 'Connected to Unity Brain'
    : lang === 'yi'
    ? 'קאַנעקטינג צו Brain...'
    : 'Connecting to Brain...'

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0056b3] to-[#001f3f]" />
      <CardHeader className="pb-3 rtl-text text-right">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="rtl-text text-right text-xl text-primary flex items-center gap-2">
            {hasInsights ? <BadgeCheck className="h-5 w-5 text-emerald-600" /> : <Zap className="h-5 w-5 text-[#0056b3]" />}
            Realtime Savings Insights
          </CardTitle>
          <div
            className={
              connected
                ? 'inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700'
            }
          >
            {connected ? <Brain className="h-4 w-4 text-emerald-700" /> : <Radio className="h-4 w-4 text-slate-600" />}
            <span className="rtl-text">{statusText}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 rtl-text text-right">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className={hasInsights ? 'text-sm text-emerald-700 font-semibold' : 'text-sm text-slate-700'}>
            {lang === 'yi' ? 'מעגליכע רעזולטאטן (לייוו):' : 'Potential Savings (Live):'}{' '}
            <span
              className={[
                'font-mono font-black',
                hasInsights ? 'text-emerald-600' : 'text-emerald-700',
                pulseAmount ? 'animate-pulse' : '',
              ].join(' ')}
            >
              ${Math.round(livePotentialMonthly)}/mo
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-black text-slate-700">
            <Sparkles className="h-4 w-4 text-[#0056b3]" />
            {liveInsights.length} insight(s)
          </div>
        </div>

        {latestInsight ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-primary truncate">{latestInsight.merchant ? String(latestInsight.merchant) : 'Insight'}</div>
                {(latestInsight.yiddish_advice || latestInsight.advice) ? (
                  <div dir="rtl" className="rtl-text text-center text-base text-slate-800 mt-3 whitespace-pre-wrap">
                    {String(latestInsight.yiddish_advice || latestInsight.advice)}
                  </div>
                ) : null}
                <div className="text-xs text-slate-500 mt-2 font-mono">{String(latestInsight.created_at || '').slice(0, 19)}</div>
              </div>
              <div className="shrink-0 text-right">
                {typeof latestInsight.amount === 'number' ? (
                  <div className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm font-black text-emerald-800">
                    ${Number(latestInsight.amount).toFixed(0)}/mo
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-black text-slate-700">
                    Insight
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : connected ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm rtl-text text-right">
            <div className="font-black text-emerald-800">
              {lang === 'yi' ? 'פֿאַרבונדן — ווארט אויף אינסייטס…' : 'Connected — waiting for insights…'}
            </div>
            <div className="mt-1 text-xs text-emerald-800/80">
              {lang === 'yi' ? 'גרייט צו באקומען JSON פון Brain.' : 'Ready to receive JSON objects from Brain.'}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-muted-foreground rtl-text text-right">
            Analyzing data...
          </div>
        )}
      </CardContent>
    </Card>
  )
}


