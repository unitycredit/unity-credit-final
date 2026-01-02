'use client'

import { useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Send } from 'lucide-react'

export default function UnityLogicAdminConsole(props: { disclaimerYI: string }) {
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<any>(null)
  const [showPerNode, setShowPerNode] = useState(true)
  const outRef = useRef<HTMLDivElement>(null)

  const context = useMemo(() => ({ disclaimer_yi: props.disclaimerYI }), [props.disclaimerYI])

  async function run() {
    if (!question.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/logic/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), context }),
      })
      const json = await res.json().catch(() => ({}))
      setResult({ ok: res.ok, status: res.status, json })
      setTimeout(() => outRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e: any) {
      setResult({ ok: false, status: 0, json: { error: e?.message || 'Request failed' } })
    } finally {
      setLoading(false)
    }
  }

  const finalText = String(result?.json?.final || result?.json?.draft || '')
  const perNode = Array.isArray(result?.json?.per_node) ? (result.json.per_node as any[]) : []

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-slate-600" />
      <CardHeader className="pb-3">
        <CardTitle className="text-xl rtl-text text-right">Unity Credit קאַנסאָול (אַדמין)</CardTitle>
        <div className="text-sm text-slate-600 rtl-text text-right">פרעגט איינמאל, באקומט א קאַנסענסוס־ענטפער פון אלע 5 נאָודס.</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="h-11 flex-1 min-w-[260px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
            placeholder="שרייבט אייער פראגע…"
          />
          <Button type="button" onClick={run} disabled={loading} className="h-11 font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            דורכפירן
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowPerNode((v) => !v)} className="h-11">
            {showPerNode ? 'באַהאַלטן נאָוד־אויסקומס' : 'ווײַזן נאָוד־אויסקומס'}
          </Button>
        </div>

        {result ? (
          <div ref={outRef} className="space-y-3">
            {result.ok ? null : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                {String(result?.json?.error || 'Request failed')}
              </div>
            )}

            {finalText ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-slate-700 rtl-text text-right">קאַנסענסוס־אויסקום</div>
                <pre className="mt-2 text-[12px] whitespace-pre-wrap break-words rtl-text text-right">{finalText}</pre>
              </div>
            ) : null}

            {showPerNode && perNode.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold text-slate-700 rtl-text text-right">נאָוד־אויסקומס פּער־נאָוד</div>
                <div className="mt-2 space-y-2">
                  {perNode.map((p, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs font-bold text-slate-800">
                        {String(p?.node || 'Node')} · {p?.ok ? 'ok' : 'error'}
                      </div>
                      {p?.ok && p?.output ? (
                        <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words rtl-text text-right">{String(p.output).slice(0, 1200)}</pre>
                      ) : (
                        <div className="mt-2 text-xs text-slate-600">{String(p?.error || '—')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}


