'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles } from 'lucide-react'

export default function UpgradeToProModal(props: { open: boolean; onOpenChange: (open: boolean) => void; sectionName?: string }) {
  const section = props.sectionName || 'Unity Intelligence Analyst'
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to Unity Pro</DialogTitle>
          <DialogDescription>
            This feature ({section}) is available on Pro. Upgrade to unlock detailed recommendations powered by Unity Intelligence.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          You can still use the rest of the dashboard for free. Pro unlocks the Unity Intelligence insights layer.
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Not now
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="font-black bg-gradient-to-r from-[#001f3f] to-[#003d7a] hover:from-[#003d7a] hover:to-[#0056b3] text-white"
            onClick={() => {
              window.location.href = '/api/checkout'
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade to Unity Pro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


