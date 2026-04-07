// tests/email/send.test.ts
// Unit tests for sendColdEmail — MAIL-01, MAIL-02, MAIL-06
// All external dependencies are mocked: transporter, supabase, dns, googleapis
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock all external dependencies ---
// vi.mock factories are hoisted to top of file, so they cannot reference outer let/const.
// Instead, mock modules with vi.fn() stubs returned inline and retrieve them via vi.mocked().

vi.mock('@/lib/email/transporter', () => ({
  getTransporter: vi.fn(),
}))

vi.mock('@/lib/db/suppression', () => ({
  isEmailSuppressed: vi.fn(),
  addToSuppressionList: vi.fn(),
}))

vi.mock('@/lib/email/mx-check', () => ({
  validateMx: vi.fn(),
}))

vi.mock('@/lib/email/rate-limiter', () => ({
  canSendToday: vi.fn(),
  DAILY_CAP: 45,
  SEND_SPACING_MS: 90_000,
}))

vi.mock('@/lib/email/unsubscribe-token', () => ({
  generateUnsubscribeToken: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
    gmail: vi.fn(),
  },
}))

// Import after mocks are set up
import { sendColdEmail } from '@/lib/email/send'
import type { Lead, EmailTemplate } from '@/lib/db/types'
import { getTransporter } from '@/lib/email/transporter'
import { isEmailSuppressed, addToSuppressionList } from '@/lib/db/suppression'
import { validateMx } from '@/lib/email/mx-check'
import { canSendToday } from '@/lib/email/rate-limiter'
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { createClient } from '@/lib/supabase/server'
import { google } from 'googleapis'

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
  categories: ['ceramika', 'bizuteria'],
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
  subject: 'Czesc {name}!',
  body: '<p>Dzien dobry {name} z {city}! Twoja dzialalnosc w kategorii {category} nas zainteresowal.</p>',
  sequence_position: 1,
  is_active: true,
  created_at: '2026-04-06T10:00:00Z',
}

// Helper to create a chainable Supabase mock
function makeSupabaseMock() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  const mockFrom = vi.fn().mockReturnValue(chain)
  vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { mockFrom, chain }
}

// Helper to create Gmail API mock
function makeGmailMock(gmailMsgId = 'gmail-msg-id-abc', historyId = '12345', threadId = 'thread-xyz') {
  const mockMessagesList = vi.fn().mockResolvedValue({
    data: { messages: [{ id: gmailMsgId }] },
  })
  const mockMessagesGet = vi.fn().mockResolvedValue({
    data: { historyId, threadId },
  })
  // Must use function constructor for 'new' usage
  vi.mocked(google.auth.OAuth2).mockImplementation(function (this: unknown) {
    (this as { setCredentials: ReturnType<typeof vi.fn> }).setCredentials = vi.fn()
  } as unknown as typeof google.auth.OAuth2)
  vi.mocked(google.gmail).mockReturnValue({
    users: { messages: { list: mockMessagesList, get: mockMessagesGet } },
  } as unknown as ReturnType<typeof google.gmail>)
  return { mockMessagesList, mockMessagesGet }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
  process.env.GMAIL_SENDER_EMAIL = 'sender@example.com'
  process.env.GMAIL_CLIENT_ID = 'client-id'
  process.env.GMAIL_CLIENT_SECRET = 'client-secret'
  process.env.GMAIL_REFRESH_TOKEN = 'refresh-token'
  process.env.UNSUBSCRIBE_SECRET = 'test-secret'
  vi.mocked(generateUnsubscribeToken).mockReturnValue('mock-unsub-token')
})

// --- Tests ---

describe('sendColdEmail — skip reasons', () => {
  it('returns { success: false, skipReason: "no_email" } when lead has no email', async () => {
    const leadNoEmail = { ...mockLead, email: null }
    const result = await sendColdEmail(leadNoEmail, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'no_email' })
    expect(isEmailSuppressed).not.toHaveBeenCalled()
  })

  it('returns { success: false, skipReason: "suppressed" } when email is suppressed', async () => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(true)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'suppressed' })
    expect(validateMx).not.toHaveBeenCalled()
  })

  it('returns { success: false, skipReason: "invalid_mx" } when MX check fails', async () => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(false)
    vi.mocked(validateMx).mockResolvedValue(false)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'invalid_mx' })
  })

  it('calls addToSuppressionList with bounce_hard when MX check fails', async () => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(false)
    vi.mocked(validateMx).mockResolvedValue(false)
    await sendColdEmail(mockLead, mockTemplate)
    expect(addToSuppressionList).toHaveBeenCalledWith('jan@example.com', 'bounce_hard')
  })

  it('returns { success: false, skipReason: "cap_reached" } when daily cap exceeded', async () => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(false)
    vi.mocked(validateMx).mockResolvedValue(true)
    vi.mocked(canSendToday).mockResolvedValue(false)
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result).toEqual({ success: false, skipReason: 'cap_reached' })
    expect(getTransporter).not.toHaveBeenCalled()
  })
})

describe('sendColdEmail — successful send', () => {
  let mockSendMail: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(false)
    vi.mocked(validateMx).mockResolvedValue(true)
    vi.mocked(canSendToday).mockResolvedValue(true)
    mockSendMail = vi.fn().mockResolvedValue({ messageId: '<msg-id-123@gmail.com>' })
    vi.mocked(getTransporter).mockReturnValue({ sendMail: mockSendMail } as unknown as ReturnType<typeof getTransporter>)
    makeGmailMock()
    makeSupabaseMock()
  })

  it('calls sendMail with correct from, to, and substituted subject', async () => {
    await sendColdEmail(mockLead, mockTemplate)
    expect(mockSendMail).toHaveBeenCalledOnce()
    const callArg = mockSendMail.mock.calls[0][0]
    expect(callArg.from).toBe('sender@example.com')
    expect(callArg.to).toBe('jan@example.com')
    expect(callArg.subject).toBe('Czesc Jan Kowalski!')
  })

  it('substitutes {name}, {city}, {category} tokens in HTML body', async () => {
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
    const { mockMessagesList } = makeGmailMock()
    await sendColdEmail(mockLead, mockTemplate)
    expect(mockMessagesList).toHaveBeenCalledOnce()
    const callArg = mockMessagesList.mock.calls[0][0]
    expect(callArg.userId).toBe('me')
  })

  it('returns { success: true, gmailMessageId, emailEventId } on success', async () => {
    const result = await sendColdEmail(mockLead, mockTemplate)
    expect(result.success).toBe(true)
    expect(result.gmailMessageId).toBe('gmail-msg-id-abc')
    expect(result.emailEventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('writes email_event row with status="sent" and Gmail IDs', async () => {
    const { mockFrom, chain } = makeSupabaseMock()
    await sendColdEmail(mockLead, mockTemplate)
    // email_events insert was called
    const emailEventCall = mockFrom.mock.calls.find((c: unknown[]) => c[0] === 'email_events')
    expect(emailEventCall).toBeDefined()
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        lead_id: 'lead-123',
        template_id: 'template-456',
        gmail_message_id: 'gmail-msg-id-abc',
        gmail_thread_id: 'thread-xyz',
        start_history_id: '12345',
      })
    )
  })

  it('updates lead status to "contacted"', async () => {
    const { mockFrom, chain } = makeSupabaseMock()
    await sendColdEmail(mockLead, mockTemplate)
    const leadsCall = mockFrom.mock.calls.find((c: unknown[]) => c[0] === 'leads')
    expect(leadsCall).toBeDefined()
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'contacted' })
    )
  })
})

describe('sendColdEmail — assertTransition validation', () => {
  it('throws if lead has invalid status for contacted transition', async () => {
    vi.mocked(isEmailSuppressed).mockResolvedValue(false)
    vi.mocked(validateMx).mockResolvedValue(true)
    vi.mocked(canSendToday).mockResolvedValue(true)
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: '<msg@gmail.com>' })
    vi.mocked(getTransporter).mockReturnValue({ sendMail: mockSendMail } as unknown as ReturnType<typeof getTransporter>)
    makeGmailMock()
    makeSupabaseMock()

    const leadWithWrongStatus: Lead = { ...mockLead, status: 'new' }
    await expect(sendColdEmail(leadWithWrongStatus, mockTemplate)).rejects.toThrow(
      'Invalid lead transition: new -> contacted'
    )
  })
})
