'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Send, Database, RefreshCw } from 'lucide-react'

export default function LogicCommandCenter({
  showCatalog = true,
}: {
  showCatalog?: boolean
}) {
  const { toast } = useToast()
  const [prompt, setPrompt] = useState<string>('ביטע געב מיר א סטרוקטורירטן היימישן דאטא־פּלאַן פאר בודזשעט־קאַטעגאָריעס.')
  const [sending, setSending] = useState(false)
  const [output, setOutput] = useState<string>('')
  const [details, setDetails] = useState<any>(null)
  const [catalogRow, setCatalogRow] = useState<any>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [generating, setGenerating] = useState(false)

  const short = useMemo(() => {
    const t = String(output || '')
    return t.length > 2200 ? t.slice(0, 2200) + '\n…' : t
  }, [output])

  async function loadCatalog() {
    if (!showCatalog) return
    setLoadingCatalog(true)
    try {
      const res = await fetch('/api/admin/optimization/catalog/latest')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load catalog')
      setCatalogRow(json?.row || null)
    } catch (e: any) {
      toast({ title: 'קאַטאַלאָג', description: e?.message || 'עס איז נישט געלונגען צו לאָדן', variant: 'destructive' })
    } finally {
      setLoadingCatalog(false)
    }
  }

  useEffect(() => {
    if (showCatalog) loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCatalog])

  async function send() {
    if (sending) return
    const q = prompt.trim()
    if (!q) return
    setSending(true)
    try {
      const res = await fetch('/api/logic/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: {} }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'דער ריקוועסט איז דורכגעפאלן')
      setOutput(String(json?.final || ''))
      setDetails(json)
    } catch (e: any) {
      toast({ title: 'קאָמאַנד־צענטער', description: e?.message || 'עס איז נישט געלונגען', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  async function generateCatalog() {
    if (!showCatalog) return
    if (generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/optimization/catalog/generate', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'עס איז נישט געלונגען צו דזשענערירן')
      setCatalogRow(json?.row || null)
      toast({ title: 'קאַטאַלאָג דזשענערירט', description: 'דער היימישער קאַטאַלאָג איז געשפּאַרט געוואָרן.' })
    } catch (e: any) {
      toast({ title: 'קאַטאַלאָג', description: e?.message || 'עס איז נישט געלונגען', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-900 to-slate-600" />
      <CardHeader className="pb-3">
        <CardTitle className="text-xl rtl-text text-right">Unity Credit קאָמאַנד־צענטער</CardTitle>
        <div className="text-sm text-slate-600 rtl-text text-right">שיקט איין פראגע און זעט דעם צוזאַמענגענומען אויסקום.</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-primary rtl-text text-right">פראגע</div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[120px]" />
          <div className="flex justify-end">
            <Button type="button" onClick={send} disabled={sending} className="h-10">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              דורכפירן
            </Button>
          </div>
        </div>

        {output ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-black text-primary mb-2 rtl-text text-right">אויסקום</div>
            <pre className="text-xs whitespace-pre-wrap break-words">{short}</pre>
          </div>
        ) : null}

        {showCatalog ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-black text-primary rtl-text text-right">היימישער קאַטאַלאָג</div>
                <div className="text-xs text-slate-600 rtl-text text-right">דזשענערירט א קאַטאַלאָג און שפּאַרט עס אין Supabase פאר מאַטשינג.</div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={loadCatalog} disabled={loadingCatalog} className="h-9">
                  {loadingCatalog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  דערהיינטיקן
                </Button>
                <Button type="button" onClick={generateCatalog} disabled={generating} className="h-9">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                  דזשענערירן
                </Button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-600">
              {catalogRow?.created_at ? `לעצטע שמירה: ${String(catalogRow.created_at).slice(0, 19)}` : 'נישטא קיין געשפּארטער קאַטאַלאָג.'}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}


