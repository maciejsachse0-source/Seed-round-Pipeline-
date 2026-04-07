// tests/email/routes.test.ts
// Unit tests for tracking pixel route + opt-out/unsubscribe route
// MAIL-05: tracking pixel records opened_at in email_events
// MAIL-07: unsubscribe validates HMAC before calling addToSuppressionList

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/email/unsubscribe-token', () => ({
  verifyUnsubscribeToken: vi.fn(),
}))

vi.mock('@/lib/db/suppression', () => ({
  addToSuppressionList: vi.fn(),
}))

// Imports after mocks
import { GET as trackingPixelGET } from '@/app/api/track/open/[eventId]/route'
import { GET as unsubscribeGET } from '@/app/api/unsubscribe/route'
import { createClient } from '@/lib/supabase/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { addToSuppressionList } from '@/lib/db/suppression'

// --- Helpers ---

function makeSupabaseMock() {
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  const mockFrom = vi.fn().mockReturnValue(updateChain)
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { mockFrom, updateChain }
}

function makeTrackRequest(eventId: string): Request {
  return new Request(`http://localhost/api/track/open/${eventId}`)
}

function makeUnsubscribeRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/unsubscribe')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --- Tracking pixel tests ---

describe('GET /api/track/open/[eventId]', () => {
  it('returns 200 with image/gif content-type', async () => {
    makeSupabaseMock()
    const req = makeTrackRequest('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

    const res = await trackingPixelGET(req, {
      params: Promise.resolve({ eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/gif')
  })

  it('returns Cache-Control: no-store to prevent open count inflation', async () => {
    makeSupabaseMock()
    const req = makeTrackRequest('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

    const res = await trackingPixelGET(req, {
      params: Promise.resolve({ eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })

    expect(res.headers.get('Cache-Control')).toContain('no-store')
  })

  it('returns a 42-byte GIF body (1x1 transparent GIF)', async () => {
    makeSupabaseMock()
    const req = makeTrackRequest('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

    const res = await trackingPixelGET(req, {
      params: Promise.resolve({ eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
    })

    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBe(42)
  })

  it('still returns pixel (200) for an invalid UUID — no info leak (T-04-08)', async () => {
    makeSupabaseMock()
    const req = makeTrackRequest('not-a-valid-uuid')

    const res = await trackingPixelGET(req, {
      params: Promise.resolve({ eventId: 'not-a-valid-uuid' }),
    })

    // Pixel always returned regardless of UUID validity
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/gif')
  })

  it('does NOT call supabase for invalid UUID (no DB hit on bad input)', async () => {
    const { mockFrom } = makeSupabaseMock()
    const req = makeTrackRequest('invalid-id')

    await trackingPixelGET(req, {
      params: Promise.resolve({ eventId: 'invalid-id' }),
    })

    // createClient should not be called for an invalid UUID
    // (fire-and-forget is only triggered after UUID validation)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// --- Unsubscribe route tests ---

describe('GET /api/unsubscribe', () => {
  it('returns 200 HTML confirmation when HMAC token is valid', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(true)
    vi.mocked(addToSuppressionList).mockResolvedValue()

    const req = makeUnsubscribeRequest({
      email: 'test@example.com',
      lead: 'lead-uuid-123',
      token: 'valid-token',
    })

    const res = await unsubscribeGET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
  })

  it('confirmation HTML contains Polish success message', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(true)
    vi.mocked(addToSuppressionList).mockResolvedValue()

    const req = makeUnsubscribeRequest({
      email: 'test@example.com',
      lead: 'lead-uuid-123',
      token: 'valid-token',
    })

    const res = await unsubscribeGET(req)
    const text = await res.text()

    expect(text).toContain('Zostales wypisany z listy mailingowej')
  })

  it('calls addToSuppressionList with email and opt_out reason when token is valid', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(true)
    vi.mocked(addToSuppressionList).mockResolvedValue()

    const req = makeUnsubscribeRequest({
      email: 'seller@example.com',
      lead: 'lead-abc',
      token: 'good-token',
    })

    await unsubscribeGET(req)

    expect(addToSuppressionList).toHaveBeenCalledWith('seller@example.com', 'opt_out')
  })

  it('returns 400 when email param is missing', async () => {
    const req = makeUnsubscribeRequest({ lead: 'lead-id', token: 'tok' })

    const res = await unsubscribeGET(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when lead param is missing', async () => {
    const req = makeUnsubscribeRequest({ email: 'a@b.com', token: 'tok' })

    const res = await unsubscribeGET(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when token param is missing', async () => {
    const req = makeUnsubscribeRequest({ email: 'a@b.com', lead: 'lead-id' })

    const res = await unsubscribeGET(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when HMAC token is invalid (T-04-09)', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(false)

    const req = makeUnsubscribeRequest({
      email: 'test@example.com',
      lead: 'lead-id',
      token: 'tampered-token',
    })

    const res = await unsubscribeGET(req)

    expect(res.status).toBe(400)
  })

  it('uses same error message for missing params and invalid token — no enumeration (T-04-10)', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(false)

    const missingReq = makeUnsubscribeRequest({ email: 'a@b.com', lead: 'id' })
    const invalidTokenReq = makeUnsubscribeRequest({
      email: 'a@b.com',
      lead: 'id',
      token: 'bad-token',
    })

    const missingRes = await unsubscribeGET(missingReq)
    const invalidRes = await unsubscribeGET(invalidTokenReq)

    expect(await missingRes.text()).toBe('Invalid unsubscribe link')
    expect(await invalidRes.text()).toBe('Invalid unsubscribe link')
  })

  it('does NOT call addToSuppressionList when token is invalid (T-04-09)', async () => {
    vi.mocked(verifyUnsubscribeToken).mockReturnValue(false)

    const req = makeUnsubscribeRequest({
      email: 'test@example.com',
      lead: 'lead-id',
      token: 'bad-token',
    })

    await unsubscribeGET(req)

    expect(addToSuppressionList).not.toHaveBeenCalled()
  })
})
