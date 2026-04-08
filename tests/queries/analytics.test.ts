// tests/queries/analytics.test.ts
// Unit tests for fetchFunnelCounts with mocked supabase.rpc
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
const mockRpc = vi.fn()
const mockCreateClient = vi.fn().mockResolvedValue({ rpc: mockRpc })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mocks
const { fetchFunnelCounts } = await import('@/lib/queries/analytics')

describe('fetchFunnelCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls supabase.rpc("get_funnel_counts") and returns FunnelRow[]', async () => {
    const fakeData = [
      { status: 'new', source_platform: 'olx', count: 10 },
      { status: 'scored', source_platform: 'google_maps', count: 5 },
    ]
    mockRpc.mockResolvedValue({ data: fakeData, error: null })

    const result = await fetchFunnelCounts()

    expect(mockRpc).toHaveBeenCalledWith('get_funnel_counts')
    expect(result).toEqual(fakeData)
  })

  it('returns empty array on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const result = await fetchFunnelCounts()

    expect(result).toEqual([])
  })
})
