'use client'

import { useState } from 'react'
import {
  Mail,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  Filter,
  Star,
} from 'lucide-react'
import ApprovalCard from '@/components/work/ApprovalCard'
import StatCard from '@/components/work/StatCard'
import { useWorkMode } from '@/components/work/WorkModeContext'

type Tab = 'inbox' | 'drafts' | 'follow-ups' | 'sent'

const draftEmails = [
  {
    id: 1,
    to: 'sarah@acmecorp.com',
    subject: 'Re: Q1 Partnership Proposal',
    preview: 'Thank you for your detailed proposal. After reviewing the terms, we would like to move forward with...',
    aiConfidence: 96,
    category: 'Follow-up',
    preparedAt: '5 min ago',
    status: 'ready' as const,
  },
  {
    id: 2,
    to: 'mike@techstart.io',
    subject: 'Project Milestone Update',
    preview: 'I wanted to share that we have completed Phase 2 of the project ahead of schedule. The next deliverables...',
    aiConfidence: 91,
    category: 'Update',
    preparedAt: '22 min ago',
    status: 'ready' as const,
  },
  {
    id: 3,
    to: 'team@company.com',
    subject: 'Weekly Team Sync — Agenda',
    preview: 'Here is the agenda for tomorrow\'s team sync: 1) Sprint review 2) Blockers discussion 3) Next week priorities...',
    aiConfidence: 98,
    category: 'Internal',
    preparedAt: '1 hr ago',
    status: 'ready' as const,
  },
]

const followUps = [
  { id: 1, contact: 'David Chen', subject: 'Contract review', daysOverdue: 3, priority: 'high' as const },
  { id: 2, contact: 'Lisa Park', subject: 'Design feedback', daysOverdue: 1, priority: 'medium' as const },
  { id: 3, contact: 'James Wilson', subject: 'Budget approval', daysOverdue: 5, priority: 'high' as const },
  { id: 4, contact: 'Emma Rodriguez', subject: 'Event coordination', daysOverdue: 0, priority: 'low' as const },
]

const inboxMessages = [
  { id: 1, from: 'Rachel Green', subject: 'New vendor proposal', time: '9:32 AM', unread: true, starred: false },
  { id: 2, from: 'Tom Baker', subject: 'Re: Quarterly review', time: '8:15 AM', unread: true, starred: true },
  { id: 3, from: 'Anna Kim', subject: 'Meeting reschedule request', time: '7:41 AM', unread: false, starred: false },
  { id: 4, from: 'Support Team', subject: 'Ticket #3892 resolved', time: 'Yesterday', unread: false, starred: false },
  { id: 5, from: 'HR Department', subject: 'Policy update — Q1', time: 'Yesterday', unread: false, starred: false },
]

export default function CommunicationHub() {
  const [activeTab, setActiveTab] = useState<Tab>('drafts')
  const { mode } = useWorkMode()

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'inbox', label: 'Inbox', count: 2 },
    { key: 'drafts', label: 'AI Drafts', count: draftEmails.length },
    { key: 'follow-ups', label: 'Follow-ups', count: followUps.filter((f) => f.daysOverdue > 0).length },
    { key: 'sent', label: 'Sent' },
  ]

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Communication Hub</h2>
        <p className="text-sm text-slate-400 mt-1">
          AI drafts your emails and messages. Preview, edit, approve, then send.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Drafts Ready"
          value={String(draftEmails.length)}
          icon={<Mail className="w-5 h-5" />}
          accent="blue"
        />
        <StatCard
          label="Follow-ups Pending"
          value={String(followUps.filter((f) => f.daysOverdue > 0).length)}
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Sent Today"
          value="7"
          icon={<Send className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Response Rate"
          value="94%"
          icon={<MessageSquare className="w-5 h-5" />}
          trend={{ value: '3%', positive: true }}
          accent="indigo"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap
              ${activeTab === tab.key
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                ${activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-500'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inbox' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">5 conversations</span>
            <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
              <Filter className="w-3 h-3" />
              Filter
            </button>
          </div>
          {inboxMessages.map((msg) => (
            <div
              key={msg.id}
              className={`
                flex items-center gap-4 rounded-xl border p-4 transition-all cursor-pointer group
                ${msg.unread
                  ? 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40'
                  : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/50'
                }
              `}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${msg.unread ? 'bg-blue-400' : 'bg-transparent'}`} />
              <Star className={`w-3.5 h-3.5 flex-shrink-0 ${msg.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${msg.unread ? 'font-semibold text-white' : 'text-slate-300'}`}>
                    {msg.from}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{msg.subject}</p>
              </div>
              <span className="text-[10px] text-slate-500 flex-shrink-0">{msg.time}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">AI prepared {draftEmails.length} drafts for your review</p>
            <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <RefreshCw className="w-3 h-3" />
              Refresh drafts
            </button>
          </div>

          {draftEmails.map((draft) => (
            <div
              key={draft.id}
              className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-5 hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">{draft.category}</span>
                  <h4 className="text-sm font-semibold text-white mt-0.5">{draft.subject}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">To: {draft.to}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${draft.aiConfidence >= 90 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-[10px] text-slate-400">AI {draft.aiConfidence}%</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-900/60 border border-slate-700/30 p-3 mb-4">
                <p className="text-xs text-slate-300 leading-relaxed">{draft.preview}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Prepared {draft.preparedAt}</span>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    Preview
                  </button>
                  <button className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    Discard
                  </button>
                  <button className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve & Send
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'follow-ups' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Smart follow-ups tracked by AI</p>
          {followUps.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-blue-500/30 transition-all"
            >
              <div className={`
                w-2 h-2 rounded-full flex-shrink-0
                ${item.priority === 'high' ? 'bg-red-400' : item.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}
              `} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white">{item.contact}</h4>
                <p className="text-xs text-slate-400">{item.subject}</p>
              </div>
              {item.daysOverdue > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-medium">
                  {item.daysOverdue}d overdue
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                  On time
                </span>
              )}
              <button className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition-all">
                Draft Follow-up
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Send className="w-10 h-10 text-slate-600 mb-3" />
          <h4 className="text-sm font-medium text-slate-300">7 messages sent today</h4>
          <p className="text-xs text-slate-500 mt-1">All outgoing communications will appear here</p>
        </div>
      )}

      {/* AI Mode notice */}
      {mode === 'autopilot' && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-300">
            <span className="font-semibold">Autopilot Active:</span> Routine follow-ups and acknowledgments are being sent automatically within your defined rules.
          </p>
        </div>
      )}
    </div>
  )
}
