// tests/api/export-route.test.ts
// Unit tests for GET /api/export with mocked supabase
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client with chained query
const mockOrder = vi.fn()
const mockIn = vi.fn().mockReturnValue({ order: mockOrder })
const mockSelect = vi.fn().mockReturnValue({ in: mockIn })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
const mockCreateClient = vi.fn().mockResolvedValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mocks
const { GET } = await import('@/app/api/export/route')

const fakeLead = {
  id: 'lead-1',
  name: 'Test Shop',
  email: 'test@example.com',
  phone: '123456789',
  city: 'Warszawa',
  source_platform: 'olx',
  status: 'interested',
  score: 85,
  created_at: '2026-04-08T00:00:00Z',
}

describe('GET /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockResolvedValue({ data: [fakeLead], error: null })
  })

  it('returns CSV with correct Content-Type and Content-Disposition for format=csv', async () => {
    const req = new Request('http://localhost/api/export?format=csv')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('returns JSON with correct Content-Type and Content-Disposition for format=json', async () => {
    const req = new Request('http://localhost/api/export?format=json')
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
  })

  it('defaults to CSV when no format param is provided', async () => {
    const req = new Request('http://localhost/api/export')
    const res = await GET(req)

    expect(res.headers.get('Content-Type')).toContain('text/csv')
  })

  it('CSV response starts with correct header row', async () => {
    const req = new Request('http://localhost/api/export?format=csv')
    const res = await GET(req)
    const body = await res.text()
    const firstLine = body.split('\n')[0]

    expect(firstLine).toBe('id,name,email,phone,city,source_platform,status,score,created_at')
  })

  it('JSON response is a valid JSON array of lead objects', async () => {
    const req = new Request('http://localhost/api/export?format=json')
    const res = await GET(req)
    const body = await res.json()

    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ id: 'lead-1', name: 'Test Shop' })
  })

  it('queries only interested and approved leads', async () => {
    const req = new Request('http://localhost/api/export?format=csv')
    await GET(req)

    expect(mockFrom).toHaveBeenCalledWith('leads')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockIn).toHaveBeenCalledWith('status', ['interested', 'approved'])
  })
})
