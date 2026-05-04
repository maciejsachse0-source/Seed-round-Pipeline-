'use client'
// components/leads/LeadProgress.tsx
// Visual step-by-step progress bar for lead pipeline journey.
// Auto-fills based on approval status + contact_status + email history.

import type { Lead, EmailEvent } from '@/lib/db/types'

interface Step {
  key: string
  label: string
  done: boolean
  active: boolean
  failed?: boolean
  date?: string | null
}

interface LeadProgressProps {
  lead: Lead & { contact_status?: string }
  emailHistory: EmailEvent[]
}

function resolveSteps(lead: Lead & { contact_status?: string }, emailHistory: EmailEvent[]): Step[] {
  const approval = lead.status
  const contact = lead.contact_status ?? 'none'
  const isRejected = approval === 'rejected'
  const isOptedOut = approval === 'opted_out'
  const isTerminal = isRejected || isOptedOut

  const firstSent = emailHistory.find(e => e.status === 'sent')
  const firstReply = emailHistory.find(e => e.status === 'replied')
  const followUps = emailHistory.filter(e => e.sequence_number > 0 && e.status === 'sent')

  const CONTACT_ORDER = ['none', 'contacted', 'followed_up', 'replied', 'interested']
  const contactIdx = CONTACT_ORDER.indexOf(contact)

  const steps: Step[] = [
    {
      key: 'scraped',
      label: 'Znaleziony',
      done: true,
      active: false,
      date: lead.created_at,
    },
    {
      key: 'scored',
      label: 'Oceniony',
      done: lead.score !== null,
      active: lead.score !== null && approval === 'new',
      date: lead.score !== null ? lead.created_at : null,
    },
    {
      key: 'approved',
      label: isRejected ? 'Odrzucony' : isOptedOut ? 'Wypisany' : 'Zatwierdzony',
      done: approval === 'approved' || isTerminal,
      active: approval === 'approved' && contact === 'none',
      failed: isTerminal,
      date: approval !== 'new' ? lead.updated_at : null,
    },
  ]

  // Only show contact steps if approved (not rejected/opted_out)
  if (!isTerminal) {
    steps.push(
      {
        key: 'contacted',
        label: 'Email wysłany',
        done: contactIdx >= 1,
        active: contact === 'contacted',
        date: firstSent?.sent_at ?? null,
      },
      {
        key: 'followed_up',
        label: `Follow-up${followUps.length > 0 ? ` (${followUps.length})` : ''}`,
        done: contactIdx >= 2,
        active: contact === 'followed_up',
        date: followUps.length > 0 ? followUps[followUps.length - 1].sent_at : null,
      },
      {
        key: 'replied',
        label: 'Odpowiedział',
        done: contactIdx >= 3,
        active: contact === 'replied',
        date: firstReply?.replied_at ?? null,
      },
      {
        key: 'interested',
        label: 'Zainteresowany',
        done: contactIdx >= 4,
        active: contact === 'interested',
        date: null,
      },
    )
  }

  return steps
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateStr))
}

export function LeadProgress({ lead, emailHistory }: LeadProgressProps) {
  const steps = resolveSteps(lead, emailHistory)
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      {/* Header with percentage */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Pipeline</h2>
        <span className="text-xs font-medium text-gray-400 tabular-nums">{pct}%</span>
      </div>

      {/* Main progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            steps.some(s => s.failed)
              ? 'bg-red-400'
              : pct === 100
              ? 'bg-emerald-500'
              : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-100" />

        <div className="space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1

            return (
              <div key={step.key} className={`relative flex items-start gap-3.5 ${isLast ? '' : 'pb-5'}`}>
                {/* Circle */}
                <div className="relative z-10 flex-shrink-0">
                  {step.done ? (
                    step.failed ? (
                      <div className="w-[30px] h-[30px] rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-[30px] h-[30px] rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )
                  ) : step.active ? (
                    <div className="w-[30px] h-[30px] rounded-full bg-indigo-100 border-2 border-indigo-400 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-[30px] h-[30px] rounded-full bg-gray-100 border-2 border-gray-200" />
                  )}
                </div>

                {/* Label + date */}
                <div className="pt-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${
                    step.done
                      ? step.failed ? 'text-red-600' : 'text-gray-900'
                      : step.active ? 'text-indigo-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-gray-400 mt-0.5">{formatShortDate(step.date)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
