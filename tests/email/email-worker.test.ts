// tests/email/email-worker.test.ts
// Unit tests for registerEmailWorker + enqueueEmailSend — T-04-06
// Mocks: pg-boss, supabase, sendColdEmail
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('@/lib/queue/boss', () => ({
  getBoss: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/email/send', () => ({
  sendColdEmail: vi.fn(),
}))

vi.mock('@/lib/email/rate-limiter', () => ({
  SEND_SPACING_MS: 90_000,
  DAILY_CAP: 45,
  canSendToday: vi.fn(),
}))

// Imports after mocks
import { registerEmailWorker, enqueueEmailSend } from '@/lib/queue/workers/email-worker'
import { getBoss } from '@/lib/queue/boss'
import { createClient } from '@/lib/supabase/server'
import { sendColdEmail } from '@/lib/email/send'
import type { Lead, EmailTemplate } from '@/lib/db/types'

// --- Fixtures ---

const mockLead: Lead = {
  id: 'lead-abc',
  name: 'Anna Nowak',
  email: 'anna@example.com',
  phone: null,
  city: 'Krakow',
  source_platform: 'olx',
  source_url: null,
  business_description: null,
  categories: ['ceramika'],
  price_range: null,
  social_links: null,
  score: 80,
  status: 'approved',
  lawful_basis: 'legitimate_interest',
  opted_out: false,
  created_at: '2026-04-06T10:00:00Z',
  updated_at: '2026-04-06T10:00:00Z',
}

const mockTemplate: EmailTemplate = {
  id: 'tpl-001',
  name: 'Cold Email 1',
  subject: 'Oferta dla {name}',
  body: '<p>Hej {name}</p>',
  sequence_position: 1,
  is_active: true,
  created_at: '2026-04-06T10:00:00Z',
}

// Helper: build a fake pg-boss instance
function makeBossMock() {
  const mockWork = vi.fn().mockResolvedValue(undefined)
  const mockSend = vi.fn().mockResolvedValue('job-id-123')
  vi.mocked(getBoss).mockResolvedValue({
    work: mockWork,
    send: mockSend,
  } as unknown as Awaited<ReturnType<typeof getBoss>>)
  return { mockWork, mockSend }
}

// Helper: build a Supabase mock that returns specific data
function makeSupabaseMock(leadData: unknown = mockLead, templateData: unknown = mockTemplate) {
  const makeSingleChain = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  })
  const leadChain = makeSingleChain(leadData)
  const templateChain = makeSingleChain(templateData)

  let callIndex = 0
  const mockFrom = vi.fn().mockImplementation(() => {
    callIndex++
    // First call = leads table, second = email_templates
    return callIndex === 1 ? leadChain : templateChain
  })

  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  return { mockFrom, leadChain, templateChain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --- registerEmailWorker tests ---

describe('registerEmailWorker', () => {
  it('calls boss.work with queue name "email-send"', async () => {
    const { mockWork } = makeBossMock()
    await registerEmailWorker()
    expect(mockWork).toHaveBeenCalledOnce()
    expect(mockWork.mock.calls[0][0]).toBe('email-send')
  })

  it('sets localConcurrency: 1 to prevent daily cap race condition', async () => {
    const { mockWork } = makeBossMock()
    await registerEmailWorker()
    expect(mockWork.mock.calls[0][1]).toMatchObject({ localConcurrency: 1 })
  })

  it('worker handler calls sendColdEmail with lead and template', async () => {
    const { mockWork } = makeBossMock()
    makeSupabaseMock(mockLead, mockTemplate)
    vi.mocked(sendColdEmail).mockResolvedValue({ success: true, emailEventId: 'evt-1', gmailMessageId: 'gid-1' })

    await registerEmailWorker()

    // Extract the handler passed to boss.work and invoke it
    const handler = mockWork.mock.calls[0][2]
    await handler([{ data: { leadId: 'lead-abc', templateId: 'tpl-001' } }])

    expect(sendColdEmail).toHaveBeenCalledWith(mockLead, mockTemplate)
  })

  it('worker handler skips and does not call sendColdEmail when lead not found', async () => {
    const { mockWork } = makeBossMock()
    makeSupabaseMock(null, mockTemplate)

    await registerEmailWorker()
    const handler = mockWork.mock.calls[0][2]
    await handler([{ data: { leadId: 'missing-lead', templateId: 'tpl-001' } }])

    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('worker handler skips when lead status is not "approved"', async () => {
    const { mockWork } = makeBossMock()
    const nonApprovedLead = { ...mockLead, status: 'contacted' } as Lead
    makeSupabaseMock(nonApprovedLead, mockTemplate)

    await registerEmailWorker()
    const handler = mockWork.mock.calls[0][2]
    await handler([{ data: { leadId: 'lead-abc', templateId: 'tpl-001' } }])

    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('worker handler skips when template not found', async () => {
    const { mockWork } = makeBossMock()
    makeSupabaseMock(mockLead, null)

    await registerEmailWorker()
    const handler = mockWork.mock.calls[0][2]
    await handler([{ data: { leadId: 'lead-abc', templateId: 'missing-tpl' } }])

    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('worker handler skips when template is not active', async () => {
    const { mockWork } = makeBossMock()
    const inactiveTemplate = { ...mockTemplate, is_active: false }
    makeSupabaseMock(mockLead, inactiveTemplate)

    await registerEmailWorker()
    const handler = mockWork.mock.calls[0][2]
    await handler([{ data: { leadId: 'lead-abc', templateId: 'tpl-001' } }])

    expect(sendColdEmail).not.toHaveBeenCalled()
  })

  it('worker handler logs skipReason and does not throw when sendColdEmail returns skipReason', async () => {
    const { mockWork } = makeBossMock()
    makeSupabaseMock(mockLead, mockTemplate)
    vi.mocked(sendColdEmail).mockResolvedValue({ success: false, skipReason: 'cap_reached' })

    await registerEmailWorker()
    const handler = mockWork.mock.calls[0][2]
    // Should not throw
    await expect(handler([{ data: { leadId: 'lead-abc', templateId: 'tpl-001' } }])).resolves.not.toThrow()
  })
})

// --- enqueueEmailSend tests ---

describe('enqueueEmailSend', () => {
  it('calls boss.send with queue name "email-send"', async () => {
    const { mockSend } = makeBossMock()
    await enqueueEmailSend('lead-abc', 'tpl-001')
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockSend.mock.calls[0][0]).toBe('email-send')
  })

  it('passes leadId and templateId as job data', async () => {
    const { mockSend } = makeBossMock()
    await enqueueEmailSend('lead-abc', 'tpl-001')
    expect(mockSend.mock.calls[0][1]).toEqual({ leadId: 'lead-abc', templateId: 'tpl-001' })
  })

  it('sets retryLimit: 0 to prevent duplicate sends', async () => {
    const { mockSend } = makeBossMock()
    await enqueueEmailSend('lead-abc', 'tpl-001')
    expect(mockSend.mock.calls[0][2]).toMatchObject({ retryLimit: 0 })
  })

  it('sets startAfter using SEND_SPACING_MS (90s minimum spacing)', async () => {
    const { mockSend } = makeBossMock()
    const beforeCall = Date.now()
    await enqueueEmailSend('lead-abc', 'tpl-001')
    const afterCall = Date.now()

    const startAfterStr = mockSend.mock.calls[0][2].startAfter as string
    const startAfterTs = new Date(startAfterStr).getTime()

    expect(startAfterTs).toBeGreaterThanOrEqual(beforeCall + 90_000)
    expect(startAfterTs).toBeLessThanOrEqual(afterCall + 90_000 + 100) // small margin
  })
})
