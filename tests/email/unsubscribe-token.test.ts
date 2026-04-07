// tests/email/unsubscribe-token.test.ts
// Unit tests for HMAC unsubscribe token generation and verification — T-04-02
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../../lib/email/unsubscribe-token'

const TEST_SECRET = 'test-secret-for-unit-tests'
const TEST_EMAIL = 'user@example.com'
const TEST_LEAD_ID = 'lead-uuid-1234'

describe('generateUnsubscribeToken', () => {
  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', TEST_SECRET)
  })

  it('returns a hex string', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(typeof token).toBe('string')
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('returns a 64-character hex string (SHA-256 = 32 bytes = 64 hex chars)', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(token).toHaveLength(64)
  })

  it('is deterministic — same inputs produce same token', () => {
    const t1 = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    const t2 = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(t1).toBe(t2)
  })

  it('differs for different email', () => {
    const t1 = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    const t2 = generateUnsubscribeToken('other@example.com', TEST_LEAD_ID)
    expect(t1).not.toBe(t2)
  })

  it('differs for different leadId', () => {
    const t1 = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    const t2 = generateUnsubscribeToken(TEST_EMAIL, 'other-lead-id')
    expect(t1).not.toBe(t2)
  })

  it('throws if UNSUBSCRIBE_SECRET is not set', () => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', '')
    expect(() => generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)).toThrow()
  })
})

describe('verifyUnsubscribeToken', () => {
  beforeEach(() => {
    vi.stubEnv('UNSUBSCRIBE_SECRET', TEST_SECRET)
  })

  it('returns true for a valid token', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(verifyUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID, token)).toBe(true)
  })

  it('returns false for a tampered token', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    const tampered = token.slice(0, -2) + 'ff'
    expect(verifyUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID, tampered)).toBe(false)
  })

  it('returns false for a completely wrong token', () => {
    expect(verifyUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID, 'tampered')).toBe(false)
  })

  it('returns false when email does not match', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(verifyUnsubscribeToken('wrong@example.com', TEST_LEAD_ID, token)).toBe(false)
  })

  it('returns false when leadId does not match', () => {
    const token = generateUnsubscribeToken(TEST_EMAIL, TEST_LEAD_ID)
    expect(verifyUnsubscribeToken(TEST_EMAIL, 'wrong-lead-id', token)).toBe(false)
  })
})
