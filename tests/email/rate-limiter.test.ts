// tests/email/rate-limiter.test.ts
// Unit tests for rate limiter — MAIL-06
// Mocks Supabase client to avoid real DB calls
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { getDailyCount, canSendToday, DAILY_CAP } from '../../lib/email/rate-limiter'
import { createClient } from '@/lib/supabase/server'

function makeMockSupabase(count: number) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count, error: null }),
        }),
      }),
    }),
  }
}

describe('DAILY_CAP', () => {
  it('is 45', () => {
    expect(DAILY_CAP).toBe(45)
  })
})

describe('getDailyCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the count from email_events for today', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(12) as never)
    const result = await getDailyCount()
    expect(result).toBe(12)
  })

  it('returns 0 when count is null', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(null as unknown as number) as never)
    const result = await getDailyCount()
    expect(result).toBe(0)
  })

  it('queries with status=sent and sent_at >= today', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
        }),
      }),
    })
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as never)

    await getDailyCount()

    expect(mockFrom).toHaveBeenCalledWith('email_events')
    const selectResult = mockFrom.mock.results[0].value
    expect(selectResult.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    const eqResult = selectResult.select.mock.results[0].value
    expect(eqResult.eq).toHaveBeenCalledWith('status', 'sent')
    const gteResult = eqResult.eq.mock.results[0].value
    // sent_at >= today (YYYY-MM-DD format)
    const today = new Date().toISOString().slice(0, 10)
    expect(gteResult.gte).toHaveBeenCalledWith('sent_at', today)
  })
})

describe('canSendToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when count < DAILY_CAP', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(44) as never)
    expect(await canSendToday()).toBe(true)
  })

  it('returns false when count == DAILY_CAP', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(45) as never)
    expect(await canSendToday()).toBe(false)
  })

  it('returns false when count > DAILY_CAP', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(50) as never)
    expect(await canSendToday()).toBe(false)
  })

  it('accepts a custom cap override', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(10) as never)
    expect(await canSendToday(10)).toBe(false)
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(9) as never)
    expect(await canSendToday(10)).toBe(true)
  })
})
