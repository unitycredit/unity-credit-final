'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { LifeBuoy, Loader2, Send } from 'lucide-react'

export default function SupportButton() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    const msg = message.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'Support', message: msg }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String((json as any)?.error || 'Failed to send'))
      setMessage('')
      setOpen(false)
      toast({
        title: 'Support',
        description: (json as any)?.ticket_id ? `Sent. Ticket: ${String((json as any).ticket_id)}` : 'Sent to Unity Admin.',
      })
    } catch (e: any) {
      toast({ title: 'Support', description: e?.message || 'Failed to send', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="bg-[#003d7a] hover:bg-[#0056b3] text-white font-black px-4">
          <LifeBuoy className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Support</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send a message to the Unity Admin</DialogTitle>
          <DialogDescription>Your message is routed to the Brain Admin support tickets inbox. No AI chat is available.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message…"
            className="min-h-[140px]"
          />
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={sending || !message.trim()} className="font-black">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


