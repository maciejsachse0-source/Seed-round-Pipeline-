'use client'
// components/leads/LeadStatusSelect.tsx
// Optimistic status dropdown — only shows valid transitions per state machine (Pitfall 5)
// T-03-06: Server Action provides second barrier; client only shows valid transitions
import { useOptimistic, useTransition } from 'react'
import { updateLeadStatus } from '@/lib/actions/leads'
import { LeadStatus, VALID_TRANSITIONS, canTransition } from '@/lib/state-machine/lead-states'

const STATUS_LABELS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: 'Nowy',
  [LeadStatus.SCORED]: 'Oceniony',
  [LeadStatus.APPROVED]: 'Zatwierdzony',
  [LeadStatus.CONTACTED]: 'Skontaktowany',
  [LeadStatus.FOLLOWED_UP]: 'Follow-up',
  [LeadStatus.REPLIED]: 'Odpowiedział',
  [LeadStatus.INTERESTED]: 'Zainteresowany',
  [LeadStatus.REJECTED]: 'Odrzucony',
  [LeadStatus.OPTED_OUT]: 'Wypisany',
}

// Status badge colors for the select element
const STATUS_COLORS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: 'bg-gray-100 text-gray-700',
  [LeadStatus.SCORED]: 'bg-blue-100 text-blue-700',
  [LeadStatus.APPROVED]: 'bg-green-100 text-green-700',
  [LeadStatus.CONTACTED]: 'bg-yellow-100 text-yellow-700',
  [LeadStatus.FOLLOWED_UP]: 'bg-orange-100 text-orange-700',
  [LeadStatus.REPLIED]: 'bg-purple-100 text-purple-700',
  [LeadStatus.INTERESTED]: 'bg-emerald-100 text-emerald-700',
  [LeadStatus.REJECTED]: 'bg-red-100 text-red-700',
  [LeadStatus.OPTED_OUT]: 'bg-slate-100 text-slate-700',
}

interface LeadStatusSelectProps {
  leadId: string
  currentStatus: LeadStatus
}

export function LeadStatusSelect({ leadId, currentStatus }: LeadStatusSelectProps) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus)
  const [isPending, startTransition] = useTransition()

  const validNextStatuses = VALID_TRANSITIONS[optimisticStatus] ?? []
  const isTerminal = validNextStatuses.length === 0

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LeadStatus
    if (!canTransition(currentStatus, next)) return

    startTransition(async () => {
      setOptimisticStatus(next)
      // Server Action validates transition server-side (T-03-06 second barrier)
      await updateLeadStatus(leadId, currentStatus, next)
      // On error: React reverts optimistic state via re-render from revalidatePath
    })
  }

  const colorClass = STATUS_COLORS[optimisticStatus] ?? 'bg-gray-100 text-gray-700'

  if (isTerminal) {
    // Terminal statuses (rejected, opted_out) — disabled, no transitions available
    return (
      <select
        disabled
        value={optimisticStatus}
        className={`text-xs px-2 py-1 border-0 rounded font-medium opacity-70 cursor-not-allowed ${colorClass}`}
      >
        <option value={optimisticStatus}>{STATUS_LABELS[optimisticStatus]}</option>
      </select>
    )
  }

  return (
    <select
      value={optimisticStatus}
      onChange={handleChange}
      disabled={isPending}
      className={`text-xs px-2 py-1 border rounded font-medium ${colorClass} ${
        isPending ? 'opacity-50' : ''
      }`}
    >
      {/* Current status as selected option */}
      <option value={optimisticStatus}>{STATUS_LABELS[optimisticStatus]}</option>
      {/* Only valid next transitions — CRITICAL: do NOT show all 9 statuses */}
      {validNextStatuses.map((next) => (
        <option key={next} value={next}>
          {STATUS_LABELS[next]}
        </option>
      ))}
    </select>
  )
}
