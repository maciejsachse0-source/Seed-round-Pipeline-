// tests/leads-query.test.ts
// Tests for fetchLeads query helper and isSortable guard
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client with full query chain
const mockRange = vi.fn().mockResolvedValue({ data: [], count: 0, error: null })
const mockOrder2 = vi.fn().mockReturnValue({ range: mockRange })
const mockOrder = vi.fn().mockReturnValue({ order: mockOrder2 })
const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
const mockOr = vi.fn().mockReturnValue({ order: mockOrder })
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder, eq: mockEq, or: mockOr })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
const mockCreateClient = vi.fn().mockResolvedValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

const { fetchLeads, fetchLeadById, fetchEmailHistory, isSortable } = await import('@/lib/queries/leads')

describe('isSortable', () => {
  it('returns true for allowed column "created_at"', () => {
    expect(isSortable('created_at')).toBe(true)
  })

  it('returns true for allowed column "score"', () => {
    expect(isSortable('score')).toBe(true)
  })

  it('returns true for allowed column "name"', () => {
    expect(isSortable('name')).toBe(true)
  })

  it('returns false for unknown column "malicious_column"', () => {
    expect(isSortable('malicious_column')).toBe(false)
  })

  it('returns false for SQL injection attempt', () => {
    expect(isSortable('created_at; DROP TABLE leads;')).toBe(false)
  })
})

describe('fetchLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the full chain
    mockRange.mockResolvedValue({ data: [], count: 50, error: null })
    mockOrder2.mockReturnValue({ range: mockRange })
    mockOrder.mockReturnValue({ order: mockOrder2 })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOr.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, or: mockOr })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('queries leads table with default params (page 1, created_at desc)', async () => {
    await fetchLeads({})
    expect(mockFrom).toHaveBeenCalledWith('leads')
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('id'),
      expect.objectContaining({ count: 'exact' })
    )
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockOrder2).toHaveBeenCalledWith('id', { ascending: true })
    // page 1: range(0, 24)
    expect(mockRange).toHaveBeenCalledWith(0, 24)
  })

  it('calculates totalPages correctly from count', async () => {
    mockRange.mockResolvedValueOnce({ data: [], count: 50, error: null })
    const result = await fetchLeads({})
    expect(result.totalPages).toBe(2)
    expect(result.count).toBe(50)
  })

  it('applies status filter when status is provided', async () => {
    // When status is provided, chain goes through .eq() before .order()
    // Reset mocks so eq returns the order chain
    const mockEqChained = vi.fn().mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEqChained, or: mockOr })

    await fetchLeads({ status: 'new' })
    expect(mockEqChained).toHaveBeenCalledWith('status', 'new')
  })

  it('falls back to "created_at" sort for unknown column', async () => {
    await fetchLeads({ sort: 'evil_column' })
    expect(mockOrder).toHaveBeenCalledWith('created_at', expect.any(Object))
  })

  it('handles ascending sort direction', async () => {
    await fetchLeads({ sort: 'score', dir: 'asc' })
    expect(mockOrder).toHaveBeenCalledWith('score', { ascending: true })
  })

  it('calculates correct range for page 2', async () => {
    await fetchLeads({ page: 2 })
    expect(mockRange).toHaveBeenCalledWith(25, 49)
  })
})
