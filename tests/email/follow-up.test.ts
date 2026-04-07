// tests/email/follow-up.test.ts
// Unit tests for scheduleFollowUp — MAIL-03
// All external dependencies are mocked: pg-boss, supabase
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('@/lib/queue/boss', () => ({
  getBoss: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Imports after mocks
import { scheduleFollowUp, DEFAULT_SEQUENCE_CONFIG } from '@/lib/email/follow-up'
import type { FollowUpConfig } from '@/lib/email/follow-up'
import { getBoss } from '@/lib/queue/boss'
import { createClient } from '@/lib/supabase/server'

// --- Helpers ---

function makeBossMock() {
  const mockSend = vi.fn().mockResolvedValue('job-id-123')
  vi.mocked(getBoss).mockResolvedValue({
    send: mockSend,
  } as unknown as Awaited<ReturnType<typeof getBoss>>)
  return { mockSend }
}

function makeSupabaseMock(configData: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: configData, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
  const mockFrom = vi.fn().mockReturnValue(chain)
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { mockFrom, chain }
}

function makeSupabaseMockWithError() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
  }
  const mockFrom = vi.fn().mockReturnValue(chain)
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { mockFrom, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const config: FollowUpConfig = { maxFollowUps: 2, intervalDays: 5 }

// --- scheduleFollowUp tests ---

describe('scheduleFollowUp — enqueue behavior', () => {
  it('calls boss.send with queue "follow-up-send" and correct data', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 1, config)

    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockSend.mock.calls[0][0]).toBe('follow-up-send')
    expect(mockSend.mock.calls[0][1]).toEqual({ leadId: 'lead-xyz', sequenceStep: 1 })
  })

  it('sets startAfter = intervalDays * 86400 seconds', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 1, config)

    const options = mockSend.mock.calls[0][2]
    // 5 days * 24 * 60 * 60 = 432000 seconds
    expect(options.startAfter).toBe(5 * 24 * 60 * 60)
  })

  it('sets retryLimit: 0 to prevent duplicate sends', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 1, { maxFollowUps: 3, intervalDays: 7 })

    const options = mockSend.mock.calls[0][2]
    expect(options.retryLimit).toBe(0)
  })

  it('uses intervalDays from config when computing startAfter', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 2, { maxFollowUps: 3, intervalDays: 7 })

    const options = mockSend.mock.calls[0][2]
    expect(options.startAfter).toBe(7 * 24 * 60 * 60)
  })
})

describe('scheduleFollowUp — no-op conditions', () => {
  it('does nothing when sequenceStep > config.maxFollowUps', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 3, config) // step 3 > maxFollowUps 2

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does nothing when sequenceStep === maxFollowUps + 1 (boundary)', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 3, { maxFollowUps: 2, intervalDays: 5 })

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('does nothing when sequenceStep < 1 (step 0 is cold email)', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 0, config)

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends when sequenceStep === maxFollowUps (within bound)', async () => {
    const { mockSend } = makeBossMock()

    await scheduleFollowUp('lead-xyz', 2, config) // step 2 === maxFollowUps 2

    expect(mockSend).toHaveBeenCalledOnce()
  })
})

// --- getSequenceConfig / getSequenceConfigForScheduler tests ---

describe('getSequenceConfig — from sequence-config query', () => {
  it('returns DEFAULT_SEQUENCE_CONFIG when DB query throws', async () => {
    // Make createClient throw
    vi.mocked(createClient).mockRejectedValue(new Error('connection refused'))

    const { getSequenceConfigForScheduler } = await import('@/lib/email/follow-up')
    const result = await getSequenceConfigForScheduler()

    expect(result).toEqual(DEFAULT_SEQUENCE_CONFIG)
  })

  it('returns DB row values when query succeeds', async () => {
    makeSupabaseMock({ id: 1, max_follow_ups: 3, interval_days: 7, updated_at: '2026-04-06T00:00:00Z' })

    // Re-import to get fresh module with cleared mock
    const { getSequenceConfigForScheduler } = await import('@/lib/email/follow-up')
    const result = await getSequenceConfigForScheduler()

    expect(result.maxFollowUps).toBe(3)
    expect(result.intervalDays).toBe(7)
  })

  it('falls back to DEFAULT_SEQUENCE_CONFIG when DB returns error', async () => {
    makeSupabaseMockWithError()

    const { getSequenceConfigForScheduler } = await import('@/lib/email/follow-up')
    const result = await getSequenceConfigForScheduler()

    expect(result).toEqual(DEFAULT_SEQUENCE_CONFIG)
  })
})

// --- DEFAULT_SEQUENCE_CONFIG export ---

describe('DEFAULT_SEQUENCE_CONFIG', () => {
  it('has maxFollowUps = 2 and intervalDays = 5', () => {
    expect(DEFAULT_SEQUENCE_CONFIG).toEqual({ maxFollowUps: 2, intervalDays: 5 })
  })
})
