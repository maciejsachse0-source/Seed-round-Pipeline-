// tests/state-machine.test.ts
// Unit tests for lead state machine — INFR-02
import { describe, it, expect } from 'vitest'
import {
  LeadStatus,
  VALID_TRANSITIONS,
  canTransition,
  assertTransition,
} from '../lib/state-machine/lead-states'

describe('canTransition', () => {
  it('allows new -> scored', () => {
    expect(canTransition(LeadStatus.NEW, LeadStatus.SCORED)).toBe(true)
  })

  it('allows new -> opted_out', () => {
    expect(canTransition(LeadStatus.NEW, LeadStatus.OPTED_OUT)).toBe(true)
  })

  it('rejects new -> replied (skipping states)', () => {
    expect(canTransition(LeadStatus.NEW, LeadStatus.REPLIED)).toBe(false)
  })

  it('rejects new -> approved (skipping scored)', () => {
    expect(canTransition(LeadStatus.NEW, LeadStatus.APPROVED)).toBe(false)
  })

  it('allows scored -> approved', () => {
    expect(canTransition(LeadStatus.SCORED, LeadStatus.APPROVED)).toBe(true)
  })

  it('allows scored -> rejected', () => {
    expect(canTransition(LeadStatus.SCORED, LeadStatus.REJECTED)).toBe(true)
  })

  it('allows contacted -> followed_up', () => {
    expect(canTransition(LeadStatus.CONTACTED, LeadStatus.FOLLOWED_UP)).toBe(true)
  })

  it('allows contacted -> replied (direct reply without follow-up)', () => {
    expect(canTransition(LeadStatus.CONTACTED, LeadStatus.REPLIED)).toBe(true)
  })

  it('allows replied -> interested', () => {
    expect(canTransition(LeadStatus.REPLIED, LeadStatus.INTERESTED)).toBe(true)
  })
})

describe('opted_out terminal state', () => {
  it('opted_out has no valid outbound transitions', () => {
    expect(VALID_TRANSITIONS[LeadStatus.OPTED_OUT]).toHaveLength(0)
  })

  it('canTransition returns false for opted_out -> new', () => {
    expect(canTransition(LeadStatus.OPTED_OUT, LeadStatus.NEW)).toBe(false)
  })

  it('canTransition returns false for opted_out -> scored', () => {
    expect(canTransition(LeadStatus.OPTED_OUT, LeadStatus.SCORED)).toBe(false)
  })

  it('canTransition returns false for opted_out -> opted_out (self-transition)', () => {
    expect(canTransition(LeadStatus.OPTED_OUT, LeadStatus.OPTED_OUT)).toBe(false)
  })
})

describe('rejected terminal state', () => {
  it('rejected has no valid outbound transitions', () => {
    expect(VALID_TRANSITIONS[LeadStatus.REJECTED]).toHaveLength(0)
  })

  it('canTransition returns false for rejected -> new', () => {
    expect(canTransition(LeadStatus.REJECTED, LeadStatus.NEW)).toBe(false)
  })
})

describe('all active states can reach opted_out', () => {
  const activeStates = [
    LeadStatus.NEW,
    LeadStatus.SCORED,
    LeadStatus.APPROVED,
    LeadStatus.CONTACTED,
    LeadStatus.FOLLOWED_UP,
    LeadStatus.REPLIED,
    LeadStatus.INTERESTED,
  ]
  for (const state of activeStates) {
    it(`${state} -> opted_out is valid`, () => {
      expect(canTransition(state, LeadStatus.OPTED_OUT)).toBe(true)
    })
  }
})

describe('assertTransition', () => {
  it('does not throw for valid transition', () => {
    expect(() => assertTransition(LeadStatus.NEW, LeadStatus.SCORED)).not.toThrow()
  })

  it('throws with correct message for invalid transition', () => {
    expect(() => assertTransition(LeadStatus.NEW, LeadStatus.REPLIED)).toThrow(
      'Invalid lead transition: new -> replied'
    )
  })

  it('throws for opted_out -> any transition', () => {
    expect(() => assertTransition(LeadStatus.OPTED_OUT, LeadStatus.NEW)).toThrow(
      'Invalid lead transition: opted_out -> new'
    )
  })
})
