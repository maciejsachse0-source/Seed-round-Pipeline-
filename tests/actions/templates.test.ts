// tests/actions/templates.test.ts
// Tests for saveTemplate and deleteTemplate Server Actions
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock Supabase server client — chainable builder
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id-123' }, error: null })
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsertEq = vi.fn().mockResolvedValue({ error: null })
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })
const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
})
const mockCreateClient = vi.fn().mockResolvedValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

const { saveTemplate, deleteTemplate } = await import('@/lib/actions/templates')
const { revalidatePath } = await import('next/cache')

const validData = {
  name: 'Welcome Email',
  subject: 'Zaproszenie do współpracy',
  body: 'Cześć {name}, witamy w naszym marketplace!',
  sequence_position: 1,
}

describe('saveTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: { id: 'new-id-123' }, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('inserts new template when id is null and returns { id }', async () => {
    const result = await saveTemplate(null, validData)
    expect(result).toEqual({ id: 'new-id-123' })
    expect(mockInsert).toHaveBeenCalledWith(validData)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/templates')
  })

  it('updates existing template when id is provided and returns { id }', async () => {
    const result = await saveTemplate('existing-id', validData)
    expect(result).toEqual({ id: 'existing-id' })
    expect(mockUpdate).toHaveBeenCalledWith(validData)
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'existing-id')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/templates')
  })

  it('returns { error } when name is empty', async () => {
    const result = await saveTemplate(null, { ...validData, name: '' })
    expect(result).toHaveProperty('error')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when subject is empty', async () => {
    const result = await saveTemplate(null, { ...validData, subject: '' })
    expect(result).toHaveProperty('error')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when body is empty', async () => {
    const result = await saveTemplate(null, { ...validData, body: '' })
    expect(result).toHaveProperty('error')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns { error } when body exceeds 5000 characters', async () => {
    const result = await saveTemplate(null, { ...validData, body: 'a'.repeat(5001) })
    expect(result).toHaveProperty('error')
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('deleteTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteEq.mockResolvedValue({ error: null })
  })

  it('deletes template and calls revalidatePath', async () => {
    const result = await deleteTemplate('tmpl-id')
    expect(result).toEqual({})
    expect(mockDelete).toHaveBeenCalled()
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'tmpl-id')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/templates')
  })

  it('returns { error } when Supabase returns an error', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'Not found' } })
    const result = await deleteTemplate('bad-id')
    expect(result).toEqual({ error: 'Not found' })
  })
})
