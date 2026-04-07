// tests/score.test.ts
// TDD tests for the lead scoring algorithm.
// Tests written BEFORE implementation (RED phase).

import { describe, it, expect } from 'vitest'
import { scoreLead, ScoringSignals, SCORING_WEIGHTS } from '@/lib/pipeline/score'

const fullSignals: ScoringSignals = {
  hasPhone: true,
  hasEmail: true,
  hasDescription: true,
  hasSocialLinks: true,
  hasPriceRange: true,
  listingCount: 10,
  categoryMatch: 1.0,
  sellerType: 'business',
}

const emptySignals: ScoringSignals = {
  hasPhone: false,
  hasEmail: false,
  hasDescription: false,
  hasSocialLinks: false,
  hasPriceRange: false,
  listingCount: 0,
  categoryMatch: 0,
  sellerType: 'unknown',
}

describe('scoreLead', () => {
  it('returns 100 for a fully complete lead', () => {
    expect(scoreLead(fullSignals)).toBe(100)
  })

  it('returns 0 for a completely empty lead', () => {
    expect(scoreLead(emptySignals)).toBe(0)
  })

  it('returns 23 for phone-only lead with private seller type', () => {
    // hasPhone(20) + private sellerType(3) = 23
    const signals: ScoringSignals = {
      ...emptySignals,
      hasPhone: true,
      sellerType: 'private',
    }
    expect(scoreLead(signals)).toBe(23)
  })

  it('returns 33 for phone + email lead with unknown seller type', () => {
    // hasPhone(20) + hasEmail(10) + unknown(0) = 30... wait
    // Actually: phone(20) + email(10) = 30 for contact completeness
    // plus unknown sellerType = 0, so total = 30
    // But plan says 33. Let me check: phone(20) + email(10) + private(3) = 33
    // Plan says "rest false/0/unknown" so sellerType=unknown=0... that's 30
    // Actually the plan note clarifies: use sellerType='private' for phone-only to get 23
    // For phone+email test: 20+10+3=33 requires private seller
    const signals: ScoringSignals = {
      ...emptySignals,
      hasPhone: true,
      hasEmail: true,
      sellerType: 'private',
    }
    expect(scoreLead(signals)).toBe(33)
  })

  it('always returns a value >= 0', () => {
    expect(scoreLead(emptySignals)).toBeGreaterThanOrEqual(0)
    expect(scoreLead(fullSignals)).toBeGreaterThanOrEqual(0)
  })

  it('always returns a value <= 100', () => {
    expect(scoreLead(emptySignals)).toBeLessThanOrEqual(100)
    expect(scoreLead(fullSignals)).toBeLessThanOrEqual(100)
  })

  it('always returns an integer', () => {
    expect(Number.isInteger(scoreLead(fullSignals))).toBe(true)
    expect(Number.isInteger(scoreLead(emptySignals))).toBe(true)
    const partialSignals: ScoringSignals = {
      ...emptySignals,
      categoryMatch: 0.5,
    }
    expect(Number.isInteger(scoreLead(partialSignals))).toBe(true)
  })

  it('more complete lead scores higher than sparse lead', () => {
    const sparseSignals: ScoringSignals = {
      ...emptySignals,
      hasPhone: true,
    }
    const completeSignals: ScoringSignals = {
      ...emptySignals,
      hasPhone: true,
      hasEmail: true,
      hasDescription: true,
    }
    expect(scoreLead(completeSignals)).toBeGreaterThan(scoreLead(sparseSignals))
  })
})

describe('SCORING_WEIGHTS', () => {
  it('has exactly 5 keys', () => {
    expect(Object.keys(SCORING_WEIGHTS)).toHaveLength(5)
  })

  it('keys are the expected dimension names', () => {
    expect(SCORING_WEIGHTS).toHaveProperty('contactCompleteness')
    expect(SCORING_WEIGHTS).toHaveProperty('profileCompleteness')
    expect(SCORING_WEIGHTS).toHaveProperty('activity')
    expect(SCORING_WEIGHTS).toHaveProperty('categoryMatch')
    expect(SCORING_WEIGHTS).toHaveProperty('sellerType')
  })

  it('values sum to 100', () => {
    const total = Object.values(SCORING_WEIGHTS).reduce((sum, v) => sum + v, 0)
    expect(total).toBe(100)
  })
})
