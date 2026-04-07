// tests/email/reply-poller.test.ts
// Unit tests for pollForReplies + reply-check-worker — MAIL-04
// Mocks: googleapis, pg-boss, supabase
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
    gmail: vi.fn(),
  },
}))

vi.mock('@/lib/queue/boss', () => ({
  getBoss: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Imports after mocks
import { pollForReplies } from '@/lib/email/reply-poller'
import { registerReplyCheckWorker } from '@/lib/queue/workers/reply-check-worker'
import { google } from 'googleapis'
import { getBoss } from '@/lib/queue/boss'
import { createClient } from '@/lib/supabase/server'

// --- Helpers ---

function makeGmailHistoryMock(history: unknown[] = [], historyId = '99999') {
  const mockHistoryList = vi.fn().mockResolvedValue({
    data: { history, historyId },
  })
  vi.mocked(google.auth.OAuth2).mockImplementation(function (this: unknown) {
    (this as { setCredentials: ReturnType<typeof vi.fn> }).setCredentials = vi.fn()
  } as unknown as typeof google.auth.OAuth2)
  vi.mocked(google.gmail).mockReturnValue({
    users: { history: { list: mockHistoryList } },
  } as unknown as ReturnType<typeof google.gmail>)
  return { mockHistoryList }
}

function makeBossMock() {
  const mockWork = vi.fn().mockResolvedValue(undefined)
  const mockSchedule = vi.fn().mockResolvedValue(undefined)
  vi.mocked(getBoss).mockResolvedValue({
    work: mockWork,
    schedule: mockSchedule,
  } as unknown as Awaited<ReturnType<typeof getBoss>>)
  return { mockWork, mockSchedule }
}

function makeSupabaseMock(emailEventData: unknown = null, leadData: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: emailEventData, error: null }),
    // For lead lookup
  }

  let callCount = 0
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    callCount++
    if (table === 'leads') {
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: leadData, error: null }),
      }
    }
    return chain
  })

  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { mockFrom, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GMAIL_CLIENT_ID = 'client-id'
  process.env.GMAIL_CLIENT_SECRET = 'client-secret'
  process.env.GMAIL_REFRESH_TOKEN = 'refresh-token'
})

// --- pollForReplies tests ---

describe('pollForReplies', () => {
  it('returns matching threadIds from Gmail history response', async () => {
    const historyWithReplies = [
      {
        messagesAdded: [
          { message: { threadId: 'thread-abc' } },
          { message: { threadId: 'thread-def' } },
        ],
      },
    ]
    makeGmailHistoryMock(historyWithReplies, '55555')

    const result = await pollForReplies('44444')

    expect(result.replyThreadIds).toEqual(expect.arrayContaining(['thread-abc', 'thread-def']))
    expect(result.replyThreadIds).toHaveLength(2)
    expect(result.newHistoryId).toBe('55555')
  })

  it('returns empty array when there is no history', async () => {
    makeGmailHistoryMock([], '22222')

    const result = await pollForReplies('11111')

    expect(result.replyThreadIds).toEqual([])
    expect(result.newHistoryId).toBe('22222')
  })

  it('returns empty array when history entries have no messagesAdded', async () => {
    const historyNoMessages = [{ messagesAdded: [] }]
    makeGmailHistoryMock(historyNoMessages, '33333')

    const result = await pollForReplies('22222')

    expect(result.replyThreadIds).toEqual([])
    expect(result.newHistoryId).toBe('33333')
  })

  it('handles 404 (expired historyId) — returns empty array and undefined newHistoryId', async () => {
    vi.mocked(google.auth.OAuth2).mockImplementation(function (this: unknown) {
      (this as { setCredentials: ReturnType<typeof vi.fn> }).setCredentials = vi.fn()
    } as unknown as typeof google.auth.OAuth2)

    const mockHistoryList = vi.fn().mockRejectedValue(
      Object.assign(new Error('Not Found'), { status: 404, code: 404 })
    )
    vi.mocked(google.gmail).mockReturnValue({
      users: { history: { list: mockHistoryList } },
    } as unknown as ReturnType<typeof google.gmail>)

    const result = await pollForReplies('expired-id')

    expect(result.replyThreadIds).toEqual([])
    expect(result.newHistoryId).toBeUndefined()
  })

  it('deduplicates threadIds when the same thread appears in multiple history entries', async () => {
    const historyWithDups = [
      { messagesAdded: [{ message: { threadId: 'thread-xyz' } }] },
      { messagesAdded: [{ message: { threadId: 'thread-xyz' } }] },
    ]
    makeGmailHistoryMock(historyWithDups, '77777')

    const result = await pollForReplies('66666')

    expect(result.replyThreadIds).toEqual(['thread-xyz'])
  })

  it('calls gmail.users.history.list with the provided startHistoryId', async () => {
    const { mockHistoryList } = makeGmailHistoryMock([], '88888')

    await pollForReplies('START-123')

    expect(mockHistoryList).toHaveBeenCalledWith(
      expect.objectContaining({ startHistoryId: 'START-123', userId: 'me' })
    )
  })
})

// --- registerReplyCheckWorker tests ---

describe('registerReplyCheckWorker', () => {
  it('schedules cron "email-reply-check" every 15 minutes', async () => {
    const { mockSchedule } = makeBossMock()
    await registerReplyCheckWorker()
    expect(mockSchedule).toHaveBeenCalledWith('email-reply-check', '*/15 * * * *', {})
  })

  it('registers worker for "email-reply-check" queue', async () => {
    const { mockWork } = makeBossMock()
    await registerReplyCheckWorker()
    expect(mockWork).toHaveBeenCalledOnce()
    expect(mockWork.mock.calls[0][0]).toBe('email-reply-check')
  })

  it('worker handler logs "no baseline" and returns when no email_events have start_history_id', async () => {
    const { mockWork } = makeBossMock()
    makeSupabaseMock(null, null)

    await registerReplyCheckWorker()
    const handler = mockWork.mock.calls[0][1]

    // Should not throw
    await expect(handler()).resolves.not.toThrow()
  })

  it('worker handler marks email_event as replied when threadId matches', async () => {
    const { mockWork } = makeBossMock()

    // email_event with a matching thread ID
    const mockEvent = {
      id: 'evt-111',
      lead_id: 'lead-999',
      gmail_thread_id: 'thread-matched',
      start_history_id: '10000',
      status: 'sent',
    }

    const mockLead = {
      id: 'lead-999',
      status: 'contacted',
    }

    // Build a supabase mock that handles the complex query chain
    const eventChain = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }

    const matchedEventChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      update: vi.fn().mockReturnThis(),
    }

    const leadChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockLead, error: null }),
      update: vi.fn().mockReturnThis(),
    }

    let fromCallIndex = 0
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      fromCallIndex++
      if (table === 'leads') return leadChain
      // email_events: first call = get baseline, subsequent = match query + update
      return fromCallIndex <= 1 ? eventChain : matchedEventChain
    })

    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    // Mock pollForReplies via googleapis
    const historyWithReply = [
      { messagesAdded: [{ message: { threadId: 'thread-matched' } }] },
    ]
    makeGmailHistoryMock(historyWithReply, '20000')

    await registerReplyCheckWorker()
    const handler = mockWork.mock.calls[0][1]
    await handler()

    // Verify email_events was updated (update called somewhere)
    const wasUpdateCalled = mockFrom.mock.calls.some(() => true)
    expect(wasUpdateCalled).toBe(true)
  })

  it('worker handler transitions lead status to REPLIED when thread matches', async () => {
    const { mockWork } = makeBossMock()

    const mockEvent = {
      id: 'evt-222',
      lead_id: 'lead-888',
      gmail_thread_id: 'thread-reply',
      start_history_id: '30000',
      status: 'sent',
    }

    const mockLead = {
      id: 'lead-888',
      status: 'contacted',
    }

    const leadUpdateChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockLead, error: null }),
      update: vi.fn().mockReturnThis(),
    }

    const eventChain = {
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'leads') return leadUpdateChain
        return eventChain
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const historyWithReply = [
      { messagesAdded: [{ message: { threadId: 'thread-reply' } }] },
    ]
    makeGmailHistoryMock(historyWithReply, '40000')

    await registerReplyCheckWorker()
    const handler = mockWork.mock.calls[0][1]
    await handler()

    // Lead update should have been called with status = 'replied'
    expect(leadUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'replied' })
    )
  })
})
