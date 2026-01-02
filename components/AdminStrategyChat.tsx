'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Brain, Radio, RotateCcw, Trash2 } from 'lucide-react'
import { useI18n } from '@/components/LanguageProvider'

type AgentName = 'Bank Analyst' | 'Bill Strategist' | 'Budgeting Bot' | 'Unity Brain Core'

type ChatMsg = {
  id: string
  agent: AgentName
  text: string
  ts: string
  raw?: any
}

const WS_URL = 'ws://localhost:8090/ws/strategy'
const STORAGE_MESSAGES = 'uc_admin_strategy_chat_v1'
const STORAGE_STATE = 'uc_admin_strategy_state_v1'
const STORAGE_SCROLL = 'uc_admin_strategy_scroll_v1'
const MAX_MESSAGES = 400

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function safeJsonParse(input: any) {
  try {
    return JSON.parse(String(input || ''))
  } catch {
    return null
  }
}

function hasHebrew(text: string) {
  return /[א-ת]/.test(String(text || ''))
}

function normalizeAgent(v: any): AgentName {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'bank analyst' || s === 'bank_analyst' || s === 'bank-analyst') return 'Bank Analyst'
  if (s === 'bill strategist' || s === 'bill_strategist' || s === 'bill-strategist') return 'Bill Strategist'
  if (s === 'budgeting bot' || s === 'budgeting_bot' || s === 'budgeting-bot') return 'Budgeting Bot'
  if (s === 'unity brain core' || s === 'unity_brain_core' || s === 'core' || s === 'brain') return 'Unity Brain Core'
  return 'Unity Brain Core'
}

function extractText(obj: any): string {
  const candidate =
    obj?.text ??
    obj?.message ??
    obj?.content ??
    obj?.thought ??
    obj?.delta ??
    obj?.payload?.text ??
    obj?.payload?.message ??
    obj?.payload?.content ??
    obj?.payload?.thought ??
    obj?.payload?.delta ??
    ''
  return String(candidate || '').trim()
}

function bubbleStyle(agent: AgentName) {
  switch (agent) {
    case 'Bank Analyst':
      return { chip: 'bg-emerald-50 border-emerald-200 text-emerald-800', bubble: 'border-emerald-200 bg-emerald-50/30' }
    case 'Bill Strategist':
      return { chip: 'bg-sky-50 border-sky-200 text-sky-800', bubble: 'border-sky-200 bg-sky-50/30' }
    case 'Budgeting Bot':
      return { chip: 'bg-amber-50 border-amber-200 text-amber-900', bubble: 'border-amber-200 bg-amber-50/30' }
    default:
      return { chip: 'bg-slate-50 border-slate-200 text-slate-800', bubble: 'border-slate-200 bg-white' }
  }
}

export default function AdminStrategyChat() {
  const { lang } = useI18n()
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<any>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const hydratedRef = useRef(false)

  const statusText = connected
    ? lang === 'yi'
      ? 'פֿאַרבונדן מיט Unity Brain'
      : 'Connected to Unity Brain'
    : lang === 'yi'
    ? 'קאַנעקטינג צו Brain...'
    : 'Connecting to Brain...'

  const statusChipClass = connected
    ? 'inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'inline-flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700'

  function cleanup() {
    try {
      wsRef.current?.close()
    } catch {
      // ignore
    }
    wsRef.current = null
    setConnected(false)
    setConnecting(false)
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      connect()
    }, 5000)
  }

  function connect() {
    if (typeof window === 'undefined') return
    cleanup()
    setConnecting(true)
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnecting(false)
        try {
          ws.send(JSON.stringify({ kind: 'hello', app: 'unity-credit-admin', channel: 'strategy', ts: nowIso() }))
        } catch {
          // ignore
        }
      }

      ws.onmessage = (ev) => {
        const parsed = typeof ev?.data === 'string' ? safeJsonParse(ev.data) : null
        const obj = parsed ?? ev?.data
        const agent = normalizeAgent((obj as any)?.agent ?? (obj as any)?.from ?? (obj as any)?.source ?? (obj as any)?.role)
        const text = extractText(obj)
        if (!text) return

        const ts = String((obj as any)?.ts || (obj as any)?.created_at || nowIso())
        const msg: ChatMsg = { id: makeId('agent'), agent, text, ts, raw: obj }
        setMessages((prev) => [...prev, msg].slice(-MAX_MESSAGES))
      }

      ws.onerror = () => {
        // onclose will follow
      }

      ws.onclose = () => {
        setConnected(false)
        setConnecting(true)
        scheduleReconnect()
      }
    } catch {
      setConnected(false)
      setConnecting(true)
      scheduleReconnect()
    }
  }

  useEffect(() => {
    // Hydrate cold storage instantly on load.
    try {
      const rawMsgs = window.localStorage.getItem(STORAGE_MESSAGES) || ''
      const parsed = rawMsgs ? safeJsonParse(rawMsgs) : null
      if (Array.isArray(parsed)) {
        const sanitized = parsed
          .filter((x) => x && typeof x === 'object' && typeof (x as any).id === 'string' && typeof (x as any).text === 'string')
          .slice(-MAX_MESSAGES) as ChatMsg[]
        setMessages(sanitized)
      }
    } catch {
      // ignore
    }
    try {
      const rawState = window.localStorage.getItem(STORAGE_STATE) || ''
      const parsed = rawState ? safeJsonParse(rawState) : null
      if (parsed && typeof parsed === 'object') {
        if (typeof (parsed as any).autoScroll === 'boolean') setAutoScroll((parsed as any).autoScroll)
      }
    } catch {
      // ignore
    }
    hydratedRef.current = true

    connect()
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoScroll) return
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // Persist chat messages + UI state.
  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      window.localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages.slice(-MAX_MESSAGES)))
    } catch {
      // ignore
    }
  }, [messages])

  useEffect(() => {
    if (!hydratedRef.current) return
    try {
      window.localStorage.setItem(STORAGE_STATE, JSON.stringify({ autoScroll }))
    } catch {
      // ignore
    }
  }, [autoScroll])

  // Restore saved scroll position once (after initial render).
  useEffect(() => {
    if (!scrollRef.current) return
    if (!hydratedRef.current) return
    try {
      const raw = window.localStorage.getItem(STORAGE_SCROLL) || ''
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) {
        scrollRef.current.scrollTop = n
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist scroll position + infer autoscroll when user scrolls.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      try {
        window.localStorage.setItem(STORAGE_SCROLL, String(el.scrollTop))
      } catch {
        // ignore
      }

      const threshold = 24
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
      setAutoScroll(atBottom)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll as any)
  }, [])

  const agentLegend = useMemo(
    () =>
      (['Bank Analyst', 'Bill Strategist', 'Budgeting Bot', 'Unity Brain Core'] as AgentName[]).map((a) => ({
        agent: a,
        style: bubbleStyle(a),
      })),
    []
  )

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#001f3f] to-[#0056b3]" />
      <CardHeader className="pb-3 rtl-text text-right">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="rtl-text text-right text-xl text-primary flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#0056b3]" />
            Admin Strategy Chat
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={statusChipClass}>
              {connected ? <Brain className="h-4 w-4 text-emerald-700" /> : <Radio className="h-4 w-4 text-slate-600" />}
              <span className="rtl-text">{statusText}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                try {
                  wsRef.current?.close()
                } catch {
                  // ignore
                }
                connect()
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {lang === 'yi' ? 'נײַ' : 'Reconnect'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                setMessages([])
                try {
                  window.localStorage.removeItem(STORAGE_MESSAGES)
                  window.localStorage.removeItem(STORAGE_SCROLL)
                } catch {
                  // ignore
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {lang === 'yi' ? 'ריין' : 'Clear'}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {agentLegend.map((x) => (
            <span key={x.agent} className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-black ${x.style.chip}`}>
              {x.agent}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-600 rtl-text text-right">
              {lang === 'yi' ? 'קאלד־סטאָרידזש: עס בלייבט אינעם בראוזער.' : 'Cold storage: kept in your browser.'}
            </div>
            <div
              className={
                autoScroll
                  ? 'inline-flex items-center gap-2 text-[11px] font-black px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'inline-flex items-center gap-2 text-[11px] font-black px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700'
              }
            >
              {lang === 'yi' ? (autoScroll ? 'אָוטאָ־סקראל: יאָ' : 'אָוטאָ־סקראל: ניין') : autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
            </div>
          </div>
          <div ref={scrollRef} className="h-[60vh] overflow-auto space-y-2">
            {messages.length ? (
              messages.map((m) => {
                const rtl = hasHebrew(m.text)
                const style = bubbleStyle(m.agent)
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${style.bubble}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-black ${style.chip}`}>
                        {m.agent}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{String(m.ts || '').slice(11, 19)}</div>
                    </div>
                    <div
                      dir={rtl ? 'rtl' : 'ltr'}
                      className={[
                        'mt-2 whitespace-pre-wrap break-words text-sm text-slate-800',
                        rtl ? 'rtl-text text-right' : 'text-left',
                      ].join(' ')}
                    >
                      {m.text}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 rtl-text text-right">
                {connected
                  ? lang === 'yi'
                    ? 'פֿאַרבונדן — ווארט אויף די אינערלעכע סטראַטעגיע־מעסעדזשעס…'
                    : 'Connected — waiting for internal strategy messages…'
                  : connecting
                  ? lang === 'yi'
                    ? 'קאַנעקטינג…'
                    : 'Connecting…'
                  : lang === 'yi'
                  ? 'אָפ־ליין'
                  : 'Offline'}
              </div>
            )}
            <div ref={listEndRef} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


