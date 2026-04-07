// tests/email/mx-check.test.ts
// Unit tests for validateMx — DATA-04
// Mocks dns.promises to avoid real network calls
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dns module before importing validateMx
vi.mock('dns', () => ({
  promises: {
    resolveMx: vi.fn(),
  },
}))

import { validateMx } from '../../lib/email/mx-check'
import { promises as dns } from 'dns'

describe('validateMx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when domain has valid MX records', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { exchange: 'mail.example.com', priority: 10 },
    ])
    const result = await validateMx('user@gmail.com')
    expect(result).toBe(true)
  })

  it('returns false when domain has empty MX record list', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([])
    const result = await validateMx('user@emptymx.com')
    expect(result).toBe(false)
  })

  it('returns false when DNS throws ENOTFOUND', async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(
      Object.assign(new Error('DNS error'), { code: 'ENOTFOUND' })
    )
    const result = await validateMx('user@nonexistent-domain-xyz.invalid')
    expect(result).toBe(false)
  })

  it('returns false when DNS throws ENODATA', async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(
      Object.assign(new Error('DNS error'), { code: 'ENODATA' })
    )
    const result = await validateMx('user@nodns.example')
    expect(result).toBe(false)
  })

  it('returns false when email has no @ sign', async () => {
    const result = await validateMx('no-at-sign')
    expect(result).toBe(false)
    expect(dns.resolveMx).not.toHaveBeenCalled()
  })

  it('returns false when email has empty domain after @', async () => {
    const result = await validateMx('user@')
    expect(result).toBe(false)
    expect(dns.resolveMx).not.toHaveBeenCalled()
  })
})
