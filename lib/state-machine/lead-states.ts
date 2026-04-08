// lib/state-machine/lead-states.ts
// INFR-02: Lead state machine with validated transitions
// Every status change in the codebase MUST call assertTransition() before writing to DB

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

// Valid transitions: key = current state, value = allowed next states
// opted_out is TERMINAL — zero transitions out (GDPR compliance)
// rejected is TERMINAL — zero transitions out
export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]:         [LeadStatus.SCORED, LeadStatus.OPTED_OUT],
  [LeadStatus.SCORED]:      [LeadStatus.APPROVED, LeadStatus.REJECTED, LeadStatus.OPTED_OUT],
  [LeadStatus.APPROVED]:    [LeadStatus.CONTACTED, LeadStatus.OPTED_OUT],
  [LeadStatus.CONTACTED]:   [LeadStatus.FOLLOWED_UP, LeadStatus.REPLIED, LeadStatus.OPTED_OUT],
  [LeadStatus.FOLLOWED_UP]: [LeadStatus.FOLLOWED_UP, LeadStatus.REPLIED, LeadStatus.OPTED_OUT],
  [LeadStatus.REPLIED]:     [LeadStatus.INTERESTED, LeadStatus.REJECTED, LeadStatus.OPTED_OUT],
  [LeadStatus.INTERESTED]:  [LeadStatus.OPTED_OUT],
  [LeadStatus.REJECTED]:    [],
  [LeadStatus.OPTED_OUT]:   [],
}

/**
 * Check whether a status transition is valid without throwing.
 */
export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

/**
 * Assert a status transition is valid, throwing if not.
 * Call this before every lead.status update in the database.
 *
 * @throws Error with message "Invalid lead transition: {from} -> {to}"
 */
export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lead transition: ${from} -> ${to}`)
  }
}
