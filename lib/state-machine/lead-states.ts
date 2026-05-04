// lib/state-machine/lead-states.ts
// Two-axis lead state machine:
//   1. Approval (manual): new → approved / rejected / opted_out
//   2. Contact status (auto + manual): none → contacted → followed_up → replied → interested

// --- Legacy enum kept for backward-compat in workers/email code ---
export enum LeadStatus {
  NEW = 'new',
  SCORED = 'scored',
  APPROVED = 'approved',
  CONTACTED = 'contacted',
  FOLLOWED_UP = 'followed_up',
  REPLIED = 'replied',
  INTERESTED = 'interested',
  REJECTED = 'rejected',
  OPTED_OUT = 'opted_out',
}

// --- Approval axis (column: status) ---
export type Approval = 'new' | 'approved' | 'rejected' | 'opted_out'

export const APPROVAL_TRANSITIONS: Record<Approval, Approval[]> = {
  new:       ['approved', 'rejected', 'opted_out'],
  approved:  ['rejected', 'opted_out'],
  rejected:  [],
  opted_out: [],
}

export function canTransitionApproval(from: Approval, to: Approval): boolean {
  return APPROVAL_TRANSITIONS[from]?.includes(to) ?? false
}

// --- Contact axis (column: contact_status) ---
export type ContactState = 'none' | 'contacted' | 'followed_up' | 'replied' | 'interested'

export const CONTACT_TRANSITIONS: Record<ContactState, ContactState[]> = {
  none:        ['contacted'],
  contacted:   ['followed_up', 'replied'],
  followed_up: ['followed_up', 'replied'],
  replied:     ['interested'],
  interested:  [],
}

// Manual transitions shown in dashboard dropdown (hides auto-only like followed_up)
const CONTACT_AUTO_ONLY: ContactState[] = ['followed_up']

export function getManualContactTransitions(from: ContactState): ContactState[] {
  return CONTACT_TRANSITIONS[from]?.filter(s => !CONTACT_AUTO_ONLY.includes(s)) ?? []
}

export function canTransitionContact(from: ContactState, to: ContactState): boolean {
  return CONTACT_TRANSITIONS[from]?.includes(to) ?? false
}

// --- Legacy helpers (used by email workers) ---
export const VALID_TRANSITIONS = {
  ...Object.fromEntries(
    Object.values(LeadStatus).map(s => [s, [] as LeadStatus[]])
  ),
} as Record<LeadStatus, LeadStatus[]>

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  // Delegate to the appropriate axis
  if (['new', 'approved', 'rejected', 'opted_out'].includes(from) &&
      ['new', 'approved', 'rejected', 'opted_out'].includes(to)) {
    return canTransitionApproval(from as Approval, to as Approval)
  }
  if (['none', 'contacted', 'followed_up', 'replied', 'interested'].includes(from) &&
      ['none', 'contacted', 'followed_up', 'replied', 'interested'].includes(to)) {
    return canTransitionContact(from as ContactState, to as ContactState)
  }
  return false
}

export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lead transition: ${from} -> ${to}`)
  }
}
