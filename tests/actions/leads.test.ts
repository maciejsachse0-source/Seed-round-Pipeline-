// tests/actions/leads.test.ts
// Tests for updateLeadStatus Server Action
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LeadStatus } from '@/lib/state-machine/lead-states'

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock Supabase server client
const mockEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
const mockCreateClient = vi.fn().mockResolvedValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mocks are set up
const { updateLeadStatus } = await import('@/lib/actions/leads')
const { revalidatePath } = await import('next/cache')

describe('updateLeadStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
  })

  it('returns {} on valid transition (new -> scored)', async () => {
    const result = await updateLeadStatus('lead-1', LeadStatus.NEW, LeadStatus.SCORED)
    expect(result).toEqual({})
    expect(mockFrom).toHaveBeenCalledWith('leads')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: LeadStatus.SCORED })
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('calls revalidatePath for dashboard and lead detail on success', async () => {
    await updateLeadStatus('lead-42', LeadStatus.NEW, LeadStatus.SCORED)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/leads/lead-42')
  })

  it('returns { error } on invalid transition (new -> contacted)', async () => {
    const result = await updateLeadStatus('lead-1', LeadStatus.NEW, LeadStatus.CONTACTED)
    expect(result).toEqual({ error: expect.stringContaining('Invalid') })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns { error: "No change" } when from === to', async () => {
    const result = await updateLeadStatus('lead-1', LeadStatus.NEW, LeadStatus.NEW)
    expect(result).toEqual({ error: 'No change' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns { error } when Supabase returns an error', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'DB connection failed' } })
    const result = await updateLeadStatus('lead-1', LeadStatus.NEW, LeadStatus.SCORED)
    expect(result).toEqual({ error: 'DB connection failed' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
