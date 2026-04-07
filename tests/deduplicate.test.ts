// tests/deduplicate.test.ts
// Unit tests for upsertLead deduplication logic
// Mocks Supabase client — no real DB calls

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock next/headers since lib/supabase/server.ts imports cookies()
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}))

import { createClient } from '@/lib/supabase/server'
import { upsertLead } from '@/lib/pipeline/deduplicate'

// Helper: build a chainable mock Supabase query builder
function makeSupabaseMock({
  upsertResult = { data: [{ id: 'abc' }], error: null },
  selectResult = { data: null, error: null },
  insertResult = { error: null },
}: {
  upsertResult?: { data: { id: string }[] | null; error: Error | null }
  selectResult?: { data: { id: string } | null; error: Error | null }
  insertResult?: { error: Error | null }
} = {}) {
  const maybeSingleFn = vi.fn().mockResolvedValue(selectResult)
  const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectAfterUpsertFn = vi.fn().mockResolvedValue(upsertResult)
  const upsertFn = vi.fn().mockReturnValue({ select: selectAfterUpsertFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const insertFn = vi.fn().mockResolvedValue(insertResult)

  const fromFn = vi.fn().mockReturnValue({
    upsert: upsertFn,
    select: selectFn,
    insert: insertFn,
  })

  return {
    from: fromFn,
    _upsertFn: upsertFn,
    _selectAfterUpsertFn: selectAfterUpsertFn,
    _selectFn: selectFn,
    _eqFn: eqFn,
    _maybeSingleFn: maybeSingleFn,
    _insertFn: insertFn,
  }
}

describe('upsertLead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('with source_url: upserts using onConflict source_url and returns created when data is returned', async () => {
    const mock = makeSupabaseMock({ upsertResult: { data: [{ id: 'lead-1' }], error: null } })
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const lead = {
      source_url: 'https://olx.pl/oferta/test-1',
      name: 'Jan Kowalski',
      source_platform: 'olx',
    }

    const result = await upsertLead(lead)

    expect(result).toBe('created')
    expect(mock._upsertFn).toHaveBeenCalledWith(lead, { onConflict: 'source_url', ignoreDuplicates: true })
    expect(mock._selectAfterUpsertFn).toHaveBeenCalledWith('id')
  })

  it('with source_url: returns duplicate when ignoreDuplicates returns empty array', async () => {
    const mock = makeSupabaseMock({ upsertResult: { data: [], error: null } })
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const lead = {
      source_url: 'https://olx.pl/oferta/already-exists',
      name: 'Anna Nowak',
      source_platform: 'olx',
    }

    const result = await upsertLead(lead)
    expect(result).toBe('duplicate')
  })

  it('with email (no source_url): upserts using onConflict email', async () => {
    const mock = makeSupabaseMock({ upsertResult: { data: [{ id: 'lead-2' }], error: null } })
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const lead = {
      email: 'seller@example.com',
      name: 'Piotr Wiśniewski',
      source_platform: 'olx',
    }

    const result = await upsertLead(lead)

    expect(result).toBe('created')
    expect(mock._upsertFn).toHaveBeenCalledWith(lead, { onConflict: 'email', ignoreDuplicates: true })
  })

  it('with phone only: checks for existing phone before insert', async () => {
    // No existing lead with this phone — select returns null, insert succeeds
    const mock = makeSupabaseMock({
      selectResult: { data: null, error: null },
      insertResult: { error: null },
    })
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const lead = {
      phone: '+48501234567',
      name: 'Maria Kowalczyk',
      source_platform: 'olx',
    }

    const result = await upsertLead(lead)

    expect(result).toBe('created')
    expect(mock._selectFn).toHaveBeenCalledWith('id')
    expect(mock._eqFn).toHaveBeenCalledWith('phone', '+48501234567')
    expect(mock._maybeSingleFn).toHaveBeenCalled()
    expect(mock._insertFn).toHaveBeenCalledWith(lead)
  })

  it('with phone match: returns duplicate when phone already exists', async () => {
    const mock = makeSupabaseMock({
      selectResult: { data: { id: 'existing-lead' }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(mock as any)

    const lead = {
      phone: '+48501234567',
      name: 'Duplicate Seller',
      source_platform: 'olx',
    }

    const result = await upsertLead(lead)

    expect(result).toBe('duplicate')
    expect(mock._insertFn).not.toHaveBeenCalled()
  })
})
