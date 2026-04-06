// tests/suppression.test.ts
// Unit tests for suppression list helpers — MAIL-08
// Uses vi.mock to avoid real Supabase connection
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client before importing the module under test
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { isEmailSuppressed, addToSuppressionList } from '../lib/db/suppression'
import { createClient } from '@/lib/supabase/server'

describe('isEmailSuppressed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when email exists in suppression_list', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: 'test@example.com' }, error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const result = await isEmailSuppressed('test@example.com')
    expect(result).toBe(true)
  })

  it('returns false when email is NOT in suppression_list', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const result = await isEmailSuppressed('clean@example.com')
    expect(result).toBe(false)
  })

  it('normalizes email to lowercase before querying', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    await isEmailSuppressed('UPPER@EXAMPLE.COM')
    expect(mockSupabase.eq).toHaveBeenCalledWith('email', 'upper@example.com')
  })
})

describe('addToSuppressionList', () => {
  it('calls upsert with normalized lowercase email', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'suppression_list') {
          return { upsert: mockUpsert }
        }
        return { update: mockUpdate }
      }),
    }
    mockUpdate.mockReturnValue({ eq: mockEq })
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    await addToSuppressionList('MIXED@Example.COM', 'opt_out')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mixed@example.com', reason: 'opt_out' })
    )
  })
})
