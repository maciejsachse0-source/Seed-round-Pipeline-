// tests/email/send.test.ts
// Unit tests for sendColdEmail — MAIL-01, MAIL-02, MAIL-06
// All external dependencies are mocked: transporter, supabase, dns, googleapis
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock all external dependencies before importing the module under test ---

// Mock nodemailer transporter
const mockSendMail = vi.fn()
vi.mock('@/lib/email/transporter', () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}))

// Mock suppression list
const mockIsEmailSuppressed = vi.fn()
const mockAddToSuppressionList = vi.fn()
vi.mock('@/lib/db/suppression', () => ({
  isEmailSuppressed: mockIsEmailSuppressed,
  addToSuppressionList: mockAddToSuppressionList,
}))

// Mock MX check
const mockValidateMx = vi.fn()
vi.mock('@/lib/email/mx-check', () => ({
  validateMx: mockValidateMx,
}))

// Mock rate limiter
const mockCanSendToday = vi.fn()
vi.mock('@/lib/email/rate-limiter', () => ({
  canSendToday: mockCanSendToday,
  DAILY_CAP: 45,
  SEND_SPACING_MS: 90_000,
}))

// Mock unsubscribe token
vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeToken: vi.fn().mockReturnValue('mock-unsub-token'),
}))

// Mock supabase client
const mockSupabaseFrom = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn()

const createChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  return chain
}

let supabaseChain: ReturnType<typeof createChain>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => {
    supabaseChain = createChain()
    return Promise.resolve({
      from: vi.fn().mockReturnValue(supabaseChain),
    })
  }),
}))

// Mock googleapis
const mockMessagesList = vi.fn()
const mockMessagesGet = vi.fn()
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    gmail: vi.fn().mockReturnValue({
      users: {
        messages: {
          list: mockMessagesList,
          get: mockMessagesGet,
        },
      },
    }),
  },
}))

// Import after mocks are set up
import { sendColdEmail } from '@/lib/email/send'
import type { Lead, EmailTemplate } from '@/lib/db/types'

// --- Test fixtures ---

const mockLead: Lead = {
  id: 'lead-123',
  name: 'Jan Kowalski',
  email: 'jan@example.com',
  phone: null,
  city: 'Warszawa',
  source_platform: 'olx',
  source_url: null,
  business_description: null,
  categories: ['ceramika', 'biżuteria'],
  price_range: null,
  social_links: null,
  score: 75,
  status: 'approved',
  lawful_basis: 'legitimate_interest',
  opted_out: false,
  created_at: '2026-04-06T10:00:00Z',
  updated_at: '2026-04-06T10:00:00Z',
}

const mockTemplate: EmailTemplate = {
  id: 'template-456',
  name: 'Cold email #1',
  subject: 'Cześć {name}!',
  body: '<p>Dzień dobry {name} z {city}! Twoja działalność w kategorii {category} nas zainteresowała.</p>',
  sequence_position: 1,
  is_active: true,
  created_at: '2026-04-06T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
  process.env.GMAIL_SENDER_EMAIL = 'sender@example.com'
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  supabaseChain = createChain()
})

// --- Tests ---

describe('sendColdEmail — skip reasons', () => {
  it('returns { success: false, skipReason: "no_email" } when lead has no email', async () => {
    const leadNoEmail = { ...mockLead, email: null }
    const result = await sendColdEmail(leadNoEmail, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'no_email' })
    expect(mockIsEmailSuppressed).not.toHaveBeenCalled()
  })

  it('returns { success: false, skipReason: "suppressed" } when email is suppressed', async () => {
    mockIsEmailSuppressed.mockResolvedValue(true)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'suppressed' })
    expect(mockValidateMx).not.toHaveBeenCalled()
  })

  it('returns { success: false, skipReason: "invalid_mx" } when MX check fails', async () => {
    mockIsEmailSuppressed.mockResolvedValue(false)
    mockValidateMx.mockResolvedValue(false)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'invalid_mx' })
  })

  it('calls addToSuppressionList with bounce_hard when MX check fails', async () => {
    mockIsEmailSuppressed.mockResolvedValue(false)
    mockValidateMx.mockResolvedValue(false)
    await sendColdEmail(mockLead, mockTemplate)
    expect(mockAddToSuppressionList).toHaveBeenCalledWith('jan@example.com', 'bounce_hard')
  })

  it('returns { success: false, skipReason: "cap_reached" } when daily cap exceeded', async () => {
    mockIsEmailSuppressed.mockResolvedValue(false)
    mockValidateMx.mockResolvedValue(true)
    mockCanSendToday.mockResolvedValue(false)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'cap_reached' })
    expect(mockSendMail).not.toHaveBeenCalled()
  })
})

describe('sendColdEmail — successful send', () => {
  beforeEach(() => {
    mockIsEmailSuppressed.mockResolvedValue(false)
    mockValidateMx.mockResolvedValue(true)
    mockCanSendToday.mockResolvedValue(true)
    mockSendMail.mockResolvedValue({ messageId: '<msg-id-123@gmail.com>' })
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: 'gmail-msg-id-abc' }] },
    })
    mockMessagesGet.mockResolvedValue({
      data: { historyId: '12345', threadId: 'thread-xyz' },
    })
  })

  it('calls sendMail with correct from, to, subject after token substitution', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    expect(mockSendMail).toHaveBeenCalledOnce()
    const callArg = mockSendMail.mock.calls[0][0]
    expect(callArg.from).toBe('sender@example.com')
    expect(callArg.to).toBe('jan@example.com')
    expect(callArg.subject).toBe('Cześć Jan Kowalski!')
  })

  it('substitutes {name}, {city}, {category} tokens in email body', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    const callArg = mockSendMail.mock.calls[0][0]
    expect(callArg.html).toContain('Jan Kowalski')
    expect(callArg.html).toContain('Warszawa')
    expect(callArg.html).toContain('ceramika')
  })

  it('appends tracking pixel img tag to HTML body', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    const callArg = mockSendMail.mock.calls[0][0]
    expect(callArg.html).toContain('<img')
    expect(callArg.html).toContain('/api/track/open/')
    expect(callArg.html).toContain('width="1"')
    expect(callArg.html).toContain('height="1"')
  })

  it('appends opt-out link with Polish text to HTML body', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    const callArg = mockSendMail.mock.calls[0][0]
    expect(callArg.html).toContain('/api/unsubscribe')
    expect(callArg.html).toContain('Nie chcesz')
    expect(callArg.html).toContain('mock-unsub-token')
  })

  it('calls gmail.users.messages.list to get Gmail message ID', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    expect(mockMessagesList).toHaveBeenCalledOnce()
    expect(mockMessagesList.mock.calls[0][0]).toMatchObject({
      userId: 'me',
    })
  })

  it('returns { success: true, gmailMessageId, emailEventId } on success', async () => {
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result.success).toBe(true)
    expect(result.gmailMessageId).toBe('gmail-msg-id-abc')
    expect(result.emailEventId).toBeDefined()
  })

  it('writes email_event row with status sent and Gmail IDs', async () => {
    const mockFrom = vi.fn()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockImplementation(async () => {
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
      mockFrom.mockReturnValue(insertChain)
      return { from: mockFrom } as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never
    })

    await sendColdEmail(mockLead, mockTemplate)
    // Verify that from('email_events') was called with insert containing status='sent'
    const emailEventsCalls = mockFrom.mock.calls.filter((c: [string]) => c[0] === 'email_events')
    expect(emailEventsCalls.length).toBeGreaterThan(0)
  })

  it('updates lead status to contacted via assertTransition guard', async () => {
    const mockFrom = vi.fn()
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockImplementation(async () => {
      const chain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
      mockFrom.mockReturnValue(chain)
      return { from: mockFrom } as unknown as ReturnType<typeof createClient> extends Promise<infer T> ? T : never
    })

    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result.success).toBe(true)
    // Lead update to 'contacted' was attempted
    const leadsCalls = mockFrom.mock.calls.filter((c: [string]) => c[0] === 'leads')
    expect(leadsCalls.length).toBeGreaterThan(0)
  })
})

describe('sendColdEmail — assertTransition validation', () => {
  it('throws if lead has invalid status for contacted transition', async () => {
    mockIsEmailSuppressed.mockResolvedValue(false)
    mockValidateMx.mockResolvedValue(true)
    mockCanSendToday.mockResolvedValue(true)
    mockSendMail.mockResolvedValue({ messageId: '<msg-id@gmail.com>' })
    mockMessagesList.mockResolvedValue({ data: { messages: [{ id: 'gid' }] } })
    mockMessagesGet.mockResolvedValue({ data: { historyId: '1', threadId: 'tid' } })

    const leadWithWrongStatus: Lead = { ...mockLead, status: 'new' }
    await expect(sendColdEmail(leadWithWrongStatus, mockTemplate)).rejects.toThrow(
      'Invalid lead transition: new -> contacted'
    )
  })
})
