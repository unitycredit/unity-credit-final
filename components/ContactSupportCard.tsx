'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ShieldCheck, Send } from 'lucide-react'

export default function ContactSupportCard() {
  const { toast } = useToast()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    const subj = subject.trim()
    const msg = message.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subj || null, message: msg }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(String((json as any)?.error || 'Failed to send'))
      }
      setSubject('')
      setMessage('')
      toast({
        title: 'Sent to Admin/Support',
        description: (json as any)?.ticket_id ? `Ticket: ${String((json as any).ticket_id)}` : 'Your message was delivered.',
      })
    } catch (e: any) {
      toast({ title: 'Support', description: e?.message || 'Failed to send', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="border-0 shadow-xl overflow-hidden bg-gradient-to-br from-white to-[#f8fafc]">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#001f3f] to-[#0056b3]" />
      <CardHeader className="pb-3 rtl-text text-right">
        <CardTitle className="rtl-text text-right text-xl text-primary flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#0056b3]" />
          Contact Admin/Support
        </CardTitle>
        <div className="rtl-text text-right text-sm text-muted-foreground">
          This is the only allowed question channel. Messages are routed to the Brain Admin inbox.
        </div>
      </CardHeader>
      <CardContent className="space-y-3 rtl-text text-right">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" className="h-11" />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your question for Admin/Support…"
          className="min-h-[120px]"
        />
        <div className="flex justify-end">
          <Button type="button" onClick={submit} disabled={sending || !message.trim()} className="h-11 font-black">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


