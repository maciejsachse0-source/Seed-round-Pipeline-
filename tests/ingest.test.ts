// tests/ingest.test.ts
// Integration tests for ingestRawLeads pipeline orchestrator
// Mocks Supabase client — no real DB calls

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before importing modules that use them
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/server'
import { ingestRawLeads } from '@/lib/pipeline/ingest'
import type { RawLead } from '@/lib/scrapers/types'

// Build a valid RawLead for testing
function makeRawLead(overrides: Partial<RawLead> = {}): RawLead {
  return {
    sourceUrl: 'https://www.olx.pl/oferta/test-listing-CID123.html',
    sourcePlatform: 'olx',
    name: 'Jan Kowalski',
    phone: '501 234 567',
    email: null,
    city: 'warszawa',
    description: 'Sprzedaję  rękodzieło handmade',
    categories: ['antyki-i-kolekcje/rekodzielo'],
    priceMin: 50,
    priceMax: 200,
    socialLinks: {},
    sellerType: 'private',
    listingCount: null,
    scrapedAt: '2026-04-06T12:00:00.000Z',
    ...overrides,
  }
}

// Helper: build a Supabase mock that returns 'created' outcome for upsertLead
function makeSupabaseMock({ upsertData = [{ id: 'lead-1' }] }: { upsertData?: { id: string }[] | null } = {}) {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectAfterUpsertFn = vi.fn().mockResolvedValue({ data: upsertData, error: null })
  const upsertFn = vi.fn().mockReturnValue({ select: selectAfterUpsertFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const insertFn = vi.fn().mockResolvedValue({ error: null })

  const fromFn = vi.fn().mockReturnValue({
    upsert: upsertFn,
    select: selectFn,
    insert: insertFn,
  })

  return {
    from: fromFn,
    _upsertFn: upsertFn,
    _insertFn: insertFn,
    _selectFn: selectFn,
  }
}

describe('ingestRawLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes phone fields before insert', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const rawLead = makeRawLead({ phone: '501 234 567' })
    await ingestRawLeads([rawLead])

    // upsertFn receives the dbLead — check that phone was normalized to E.164
    const upsertCall = mock._upsertFn.mock.calls[0][0]
    expect(upsertCall.phone).toBe('+48501234567')
  })

  it('normalizes city fields before insert', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const rawLead = makeRawLead({ city: 'warszawa' })
    await ingestRawLeads([rawLead])

    const upsertCall = mock._upsertFn.mock.calls[0][0]
    expect(upsertCall.city).toBe('Warszawa')
  })

  it('computes score for each lead and includes it in the DB record', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    // has phone (+20), has description (+10), has price range (+7), activity 0 (+0), categoryMatch 1.0 (+15), private (+3) = 55
    const rawLead = makeRawLead({ phone: '501 234 567', priceMin: 50, priceMax: 200, socialLinks: {} })
    await ingestRawLeads([rawLead])

    const upsertCall = mock._upsertFn.mock.calls[0][0]
    expect(upsertCall.score).toBeTypeOf('number')
    expect(upsertCall.score).toBeGreaterThan(0)
    expect(upsertCall.score).toBeLessThanOrEqual(100)
  })

  it('returns ScraperResult with created, duplicate, errors counts', async () => {
    // First lead creates, second lead is duplicate
    const mock1 = makeSupabaseMock({ upsertData: [{ id: 'lead-1' }] })
    const mock2 = makeSupabaseMock({ upsertData: [] }) // empty = duplicate

    let callCount = 0
    vi.mocked(createClient).mockImplementation(async () => {
      callCount++
      return callCount === 1 ? (mock1 as any) : (mock2 as any)
    })

    const leads = [
      makeRawLead({ sourceUrl: 'https://www.olx.pl/oferta/lead-1-CID123.html' }),
      makeRawLead({ sourceUrl: 'https://www.olx.pl/oferta/lead-2-CID456.html' }),
    ]
    const result = await ingestRawLeads(leads)

    expect(result.created).toBe(1)
    expect(result.duplicate).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('increments errors count for invalid RawLead (missing sourceUrl)', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    // Invalid: sourceUrl is empty string (not a valid URL)
    const invalidLead = makeRawLead({ sourceUrl: '' })
    const result = await ingestRawLeads([invalidLead])

    expect(result.errors).toBe(1)
    expect(result.created).toBe(0)
    expect(result.duplicate).toBe(0)
    // No DB call should be made
    expect(mock._upsertFn).not.toHaveBeenCalled()
  })

  it('maps description to business_description DB column', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const rawLead = makeRawLead({ description: 'Rękodzieło artystyczne' })
    await ingestRawLeads([rawLead])

    const upsertCall = mock._upsertFn.mock.calls[0][0]
    expect(upsertCall.business_description).toBe('Rękodzieło artystyczne')
    expect(upsertCall.description).toBeUndefined()
  })

  it('maps priceMin/priceMax to price_range string', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const rawLead = makeRawLead({ priceMin: 100, priceMax: 500 })
    await ingestRawLeads([rawLead])

    const upsertCall = mock._upsertFn.mock.calls[0][0]
    expect(upsertCall.price_range).toBe('100-500 PLN')
    expect(upsertCall.priceMin).toBeUndefined()
    expect(upsertCall.priceMax).toBeUndefined()
  })
})
