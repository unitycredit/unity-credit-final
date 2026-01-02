'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { fillTemplate, type InsuranceNegotiationInput as NegotiationInput } from '@/lib/negotiator'

type Line = 'home' | 'car' | 'life'

export type InsuranceNegotiationDraft = {
  line: Line
  to: string
  provider_name: string
  subject_yi: string
  body_yi: string
}

export default function InsuranceNegotiationInput(props: {
  templates: { home: string; car: string; life: string }
  defaultTo?: string
  defaultProvider?: string
  providerOptions?: Partial<Record<Line, string[]>>
  onDraftChange?: (draft: InsuranceNegotiationDraft) => void
}) {
  const [line, setLine] = useState<Line>('home')
  const [to, setTo] = useState(props.defaultTo || '')
  const [provider, setProvider] = useState(props.defaultProvider || '')
  const providerOptions = useMemo(() => {
    const list = props.providerOptions?.[line] || []
    return Array.from(new Set(list.map(String).map((s) => s.trim()).filter(Boolean))).slice(0, 30)
  }, [props.providerOptions, line])

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [currentPremium, setCurrentPremium] = useState('')
  const [desiredSavings, setDesiredSavings] = useState('')
  const [notes, setNotes] = useState('')

  const [subject, setSubject] = useState('ביטע איבערקוקן מיין הויז־אינשורענס פאליסי')
  const [bodyOverride, setBodyOverride] = useState('')

  useEffect(() => {
    setSubject(
      line === 'car'
        ? 'ביטע איבערקוקן מיין קאר־אינשורענס פאליסי'
        : line === 'life'
        ? 'ביטע איבערקוקן מיין לייף־אינשורענס פאליסי'
        : 'ביטע איבערקוקן מיין הויז־אינשורענס פאליסי'
    )
    // Reset body override when switching lines (keeps drafting predictable).
    setBodyOverride('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])

  const baseTemplate = useMemo(() => {
    return line === 'car' ? props.templates.car : line === 'life' ? props.templates.life : props.templates.home
  }, [line, props.templates])

  const filled = useMemo(() => {
    const input: NegotiationInput = {
      line,
      name,
      address,
      policy_number: policyNumber,
      phone,
      provider_name: provider,
      email,
      current_premium_monthly: currentPremium ? Number(currentPremium) : undefined,
      desired_monthly_savings: desiredSavings ? Number(desiredSavings) : undefined,
      notes: notes || undefined,
    }
    return fillTemplate(baseTemplate, input)
  }, [line, name, address, policyNumber, phone, provider, email, currentPremium, desiredSavings, notes, baseTemplate])

  const body = bodyOverride || filled

  useEffect(() => {
    props.onDraftChange?.({
      line,
      to,
      provider_name: provider,
      subject_yi: subject,
      body_yi: body,
    })
  }, [line, to, provider, subject, body, props])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Line</div>
          <select
            value={line}
            onChange={(e) => setLine(e.target.value === 'car' ? 'car' : e.target.value === 'life' ? 'life' : 'home')}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="home">Home</option>
            <option value="car">Car</option>
            <option value="life">Life</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Provider name</div>
          <div className="flex gap-2">
            <select
              value={providerOptions.includes(provider) ? provider : ''}
              onChange={(e) => setProvider(e.target.value || '')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm min-w-[180px]"
            >
              <option value="">{providerOptions.length ? 'Select…' : 'No list'}</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} className="h-10 flex-1" placeholder="Type provider (optional)" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Send to (email)</div>
          <Input value={to} onChange={(e) => setTo(e.target.value)} className="h-10" placeholder="agent@company.com" />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Subject (Yiddish)</div>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold text-slate-700">Fill details (optional)</div>
        <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder="Name" />
          <Input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className="h-10" placeholder="Policy number" />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-10" placeholder="Address" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10" placeholder="Phone" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" placeholder="Email" />
          <Input value={currentPremium} onChange={(e) => setCurrentPremium(e.target.value)} className="h-10" placeholder="Current premium (optional)" />
          <Input value={desiredSavings} onChange={(e) => setDesiredSavings(e.target.value)} className="h-10" placeholder="Desired savings (optional)" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10" placeholder="Notes (optional)" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700">Draft letter (Yiddish)</div>
        <textarea
          value={body}
          onChange={(e) => setBodyOverride(e.target.value)}
          className="w-full min-h-[240px] rounded-xl border border-slate-200 bg-white p-3 text-sm rtl-text text-right"
        />
        <div className="flex justify-end gap-2 flex-wrap">
          <Button type="button" variant="outline" className="h-10" onClick={() => setBodyOverride('')}>
            Reset to auto‑draft
          </Button>
        </div>
      </div>
    </div>
  )
}


