'use client'
// components/leads/LeadStatusSelect.tsx
// Two separate dropdowns for the two-axis lead state machine:
//   1. ApprovalSelect — manual evaluation (status column)
//   2. ContactStatusSelect — email pipeline progress (contact_status column)

import { useOptimistic, useTransition } from 'react'
import { updateLeadApproval, updateLeadContactStatus } from '@/lib/actions/leads'
import {
  APPROVAL_TRANSITIONS,
  getManualContactTransitions,
  canTransitionApproval,
  canTransitionContact,
  type Approval,
  type ContactState,
} from '@/lib/state-machine/lead-states'

// --- Approval labels & colors ---
const APPROVAL_LABELS: Record<Approval, string> = {
  new: 'Nowy',
  approved: 'Zatwierdzony',
  rejected: 'Odrzucony',
  opted_out: 'Wypisany',
}

const APPROVAL_COLORS: Record<Approval, string> = {
  new: 'bg-gray-100 text-gray-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  opted_out: 'bg-slate-100 text-slate-700',
}

// --- Contact status labels & colors ---
const CONTACT_LABELS: Record<ContactState, string> = {
  none: '—',
  contacted: 'Email wysłany',
  followed_up: 'Follow-up',
  replied: 'Odpowiedział',
  interested: 'Zainteresowany',
}

const CONTACT_COLORS: Record<ContactState, string> = {
  none: 'bg-gray-50 text-gray-400',
  contacted: 'bg-yellow-100 text-yellow-700',
  followed_up: 'bg-orange-100 text-orange-700',
  replied: 'bg-purple-100 text-purple-700',
  interested: 'bg-emerald-100 text-emerald-700',
}

// --- Approval Select ---
export function ApprovalSelect({ leadId, current }: { leadId: string; current: Approval }) {
  const [optimistic, setOptimistic] = useOptimistic(current)
  const [isPending, startTransition] = useTransition()

  const options = APPROVAL_TRANSITIONS[optimistic] ?? []
  const isTerminal = options.length === 0
  const colorClass = APPROVAL_COLORS[optimistic] ?? 'bg-gray-100 text-gray-700'

  if (isTerminal) {
    return (
      <span className={`text-xs px-2 py-1 rounded font-medium ${colorClass} opacity-70`}>
        {APPROVAL_LABELS[optimistic]}
      </span>
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Approval
    if (!canTransitionApproval(current, next)) return
    startTransition(async () => {
      setOptimistic(next)
      await updateLeadApproval(leadId, current, next)
    })
  }

  return (
    <select
      value={optimistic}
      onChange={handleChange}
      disabled={isPending}
      className={`text-xs px-2 py-1 border rounded font-medium ${colorClass} ${isPending ? 'opacity-50' : ''}`}
    >
      <option value={optimistic}>{APPROVAL_LABELS[optimistic]}</option>
      {options.map((next) => (
        <option key={next} value={next}>{APPROVAL_LABELS[next]}</option>
      ))}
    </select>
  )
}

// --- Contact Status Select ---
export function ContactStatusSelect({ leadId, current }: { leadId: string; current: ContactState }) {
  const [optimistic, setOptimistic] = useOptimistic(current)
  const [isPending, startTransition] = useTransition()

  const manualOptions = getManualContactTransitions(optimistic)
  const colorClass = CONTACT_COLORS[optimistic] ?? 'bg-gray-50 text-gray-400'

  // No manual options available — show as badge
  if (manualOptions.length === 0) {
    return (
      <span className={`text-xs px-2 py-1 rounded font-medium ${colorClass}`}>
        {CONTACT_LABELS[optimistic]}
      </span>
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ContactState
    if (!canTransitionContact(current, next)) return
    startTransition(async () => {
      setOptimistic(next)
      await updateLeadContactStatus(leadId, current, next)
    })
  }

  return (
    <select
      value={optimistic}
      onChange={handleChange}
      disabled={isPending}
      className={`text-xs px-2 py-1 border rounded font-medium ${colorClass} ${isPending ? 'opacity-50' : ''}`}
    >
      <option value={optimistic}>{CONTACT_LABELS[optimistic]}</option>
      {manualOptions.map((next) => (
        <option key={next} value={next}>{CONTACT_LABELS[next]}</option>
      ))}
    </select>
  )
}
