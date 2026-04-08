// tests/queue/follow-up-worker.test.ts
// Unit tests for follow-up worker — MAIL-03
// Tests all stop conditions and the send-then-schedule-next flow
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockBossWork = vi.fn()
const mockBossSend = vi.fn().mockResolvedValue('job-id')

vi.mock('@/lib/queue/boss', () => ({
  getBoss: vi.fn().mockResolvedValue({
    work: mockBossWork,
    send: mockBossSend,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/email/send', () => ({
  sendColdEmail: vi.fn(),
}))

vi.mock('@/lib/email/follow-up', () => ({
  scheduleFollowUp: vi.fn(),
  getSequenceConfigForScheduler: vi.fn().mockResolvedValue({ maxFollowUps: 2, intervalDays: 5 }),
}))

// Imports after mocks
import { createClient } from '@/lib/supabase/server'
import { sendColdEmail } from '@/lib/email/send'
import { scheduleFollowUp, getSequenceConfigForScheduler } from '@/lib/email/follow-up'
import { LeadStatus } from '@/lib/state-machine/lead-states'

// --- Helpers ---

function makeLeadData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-123',
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    phone: null,
    city: 'Krakow',
    source_platform: 'olx',
    source_url: null,
    business_description: null,
    categories: ['handmade'],
    price_range: null,
    social_links: null,
    score: 75,
    status: 'contacted',
    lawful_basis: 'legitimate_interest',
    opted_out: false,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

function makeTemplateData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl-1',
    name: 'Follow-up 1',
    subject: 'Following up',
    body: '<p>Hello {{name}}</p>',
    sequence_position: 1,
    is_active: true,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

type SupabaseQueryResult = { data: unknown; error: unknown }

function makeSupabaseMock(options: {
  leadResult?: SupabaseQueryResult
  templateResult?: SupabaseQueryResult
}) {
  const leadChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(options.leadResult ?? { data: null, error: null }),
  }
  const templateChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(options.templateResult ?? { data: null, error: null }),
  }

  let callCount = 0
  const mockFrom = vi.fn().mockImplementation(() => {
    callCount++
    // First from() call is for leads, second is for email_templates
    return callCount === 1 ? leadChain : templateChain
  })

  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { mockFrom, leadChain, templateChain }
}

/**
 * Register the worker, capture the handler callback, and return it for testing.
 */
async function getWorkerHandler() {
  // Reset to capture fresh registration
  mockBossWork.mockClear()

  const { registerFollowUpWorker } = await import('@/lib/queue/workers/follow-up-worker')
  await registerFollowUpWorker()

  expect(mockBossWork).toHaveBeenCalledOnce()
  expect(mockBossWork.mock.calls[0][0]).toBe('follow-up-send')

  // The handler is the third argument (after queue name and options)
  const handler = mockBossWork.mock.calls[0][2] as (jobs: Array<{ data: unknown; id: string }>) => Promise<void>
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBossWork.mockClear()
  mockBossSend.mockClear()
})

// --- Registration ---

describe('registerFollowUpWorker', () => {
  it('registers a worker on the "follow-up-send" queue', async () => {
    await getWorkerHandler()
    expect(mockBossWork.mock.calls[0][0]).toBe('follow-up-send')
  })

  it('sets localConcurrency to 1', async () => {
    await getWorkerHandler()
    const options = mockBossWork.mock.calls[0][1]
    expect(options).toEqual(expect.objectContaining({ localConcurrency: 1 }))
  })
})

// --- Stop conditions ---

describe('follow-up worker — stop conditions', () => {
  it('skips send when lead not found', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({ leadResult: { data: null, error: null } })

    await handler([{ data: { leadId: 'lead-404', sequenceStep: 1 }, id: 'job-1' }])

    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })

  it('skips send when lead.status = "replied"', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData({ status: 'replied' }), error: null },
    })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-2' }])

    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })

  it('skips send when lead.status = "opted_out"', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData({ status: 'opted_out' }), error: null },
    })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-3' }])

    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })

  it('skips send when lead.status = "approved" (not in active sequence)', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData({ status: 'approved' }), error: null },
    })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-4' }])

    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })

  it('skips send when no active template for sequence_position', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData(), error: null },
      templateResult: { data: null, error: null },
    })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-5' }])

    expect(sendColdEmail).not.toHaveBeenCalled()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })
})

// --- Successful send flow ---

describe('follow-up worker — successful send', () => {
  it('calls sendColdEmail with targetStatus=FOLLOWED_UP and correct sequenceNumber when lead.status is "contacted"', async () => {
    const handler = await getWorkerHandler()
    const lead = makeLeadData({ status: 'contacted' })
    const template = makeTemplateData()
    makeSupabaseMock({
      leadResult: { data: lead, error: null },
      templateResult: { data: template, error: null },
    })
    vi.mocked(sendColdEmail).mockResolvedValue({ success: true, emailEventId: 'evt-1' })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-6' }])

    expect(sendColdEmail).toHaveBeenCalledOnce()
    expect(sendColdEmail).toHaveBeenCalledWith(lead, template, {
      targetStatus: LeadStatus.FOLLOWED_UP,
      sequenceNumber: 1,
    })
  })

  it('calls sendColdEmail with targetStatus=FOLLOWED_UP when lead.status is "followed_up"', async () => {
    const handler = await getWorkerHandler()
    const lead = makeLeadData({ status: 'followed_up' })
    const template = makeTemplateData({ sequence_position: 2 })
    makeSupabaseMock({
      leadResult: { data: lead, error: null },
      templateResult: { data: template, error: null },
    })
    vi.mocked(sendColdEmail).mockResolvedValue({ success: true, emailEventId: 'evt-2' })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 2 }, id: 'job-7' }])

    expect(sendColdEmail).toHaveBeenCalledOnce()
    expect(sendColdEmail).toHaveBeenCalledWith(lead, template, {
      targetStatus: LeadStatus.FOLLOWED_UP,
      sequenceNumber: 2,
    })
  })

  it('schedules next step after successful send', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData(), error: null },
      templateResult: { data: makeTemplateData(), error: null },
    })
    vi.mocked(sendColdEmail).mockResolvedValue({ success: true, emailEventId: 'evt-3' })
    vi.mocked(getSequenceConfigForScheduler).mockResolvedValue({ maxFollowUps: 2, intervalDays: 5 })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-8' }])

    expect(getSequenceConfigForScheduler).toHaveBeenCalledOnce()
    expect(scheduleFollowUp).toHaveBeenCalledOnce()
    expect(scheduleFollowUp).toHaveBeenCalledWith('lead-123', 2, { maxFollowUps: 2, intervalDays: 5 })
  })
})

// --- Failed send flow ---

describe('follow-up worker — failed send', () => {
  it('does NOT schedule next step when sendColdEmail returns success=false', async () => {
    const handler = await getWorkerHandler()
    makeSupabaseMock({
      leadResult: { data: makeLeadData(), error: null },
      templateResult: { data: makeTemplateData(), error: null },
    })
    vi.mocked(sendColdEmail).mockResolvedValue({ success: false, skipReason: 'cap_reached' })

    await handler([{ data: { leadId: 'lead-123', sequenceStep: 1 }, id: 'job-9' }])

    expect(sendColdEmail).toHaveBeenCalledOnce()
    expect(scheduleFollowUp).not.toHaveBeenCalled()
  })
})
