import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function PremiumSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-[#0b1220] dark:to-[#020617] dark:text-white relative">
      <Navbar />

      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Payment confirmed</div>
              <div className="text-sm text-muted-foreground mt-1">
                Your account is now enabled for the <span className="font-semibold text-foreground">Enterprise / Unity Credit</span> plan.
              </div>
            </div>
          </div>

          <Card className="border-0 shadow-2xl overflow-hidden bg-card text-card-foreground dark:bg-gradient-to-br dark:from-white/5 dark:to-white/[0.02]">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300" />
            <CardHeader className="pb-3">
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                Thank you
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Unity Credit Processing is active. Automated Savings Nodes and 5‑Node Consensus Logic are now available on your dashboard.
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'Unity Credit Processing', desc: 'Enterprise-grade decision flow with verifiable outcomes.' },
                  { title: 'Automated Savings Nodes', desc: 'Continuous savings detection and eligible-switch monitoring.' },
                  { title: 'Secure billing', desc: 'Card data is processed by PCI-compliant payment rails.' },
                ].map((f) => (
                  <div key={f.title} className="rounded-2xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-black text-foreground dark:text-white">{f.title}</div>
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-1 shrink-0" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 dark:text-white/55">{f.desc}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button type="button" className="h-11 font-black bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 hover:opacity-95">
                    Continue to dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button type="button" variant="outline" className="h-11">
                    Manage settings
                  </Button>
                </Link>
              </div>

              <div className="text-xs text-muted-foreground dark:text-white/55">
                If you don’t see Enterprise access immediately, refresh once (your session may still be updating).
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


