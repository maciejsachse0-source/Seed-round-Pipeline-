// tests/queue.test.ts
// Smoke test for pg-boss singleton — INFR-03
// Tests the singleton behavior and error handling, not actual DB connectivity
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pg-boss before importing boss.ts
vi.mock('pg-boss', () => {
  class MockPgBoss {
    on = vi.fn()
    start = vi.fn().mockResolvedValue(undefined)
    send = vi.fn().mockResolvedValue('mock-job-id')
    work = vi.fn().mockResolvedValue(undefined)
  }
  return { default: MockPgBoss, PgBoss: MockPgBoss }
})

// Reset the singleton between tests
beforeEach(() => {
  const g = global as typeof globalThis & { boss?: unknown }
  delete g.boss
  vi.clearAllMocks()
})

describe('getBoss singleton', () => {
  it('throws if DATABASE_URL is not set', async () => {
    const originalUrl = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    const { getBoss } = await import('../lib/queue/boss')
    await expect(getBoss()).rejects.toThrow('DATABASE_URL env var is missing')

    process.env.DATABASE_URL = originalUrl
  })

  it('returns a pg-boss instance when DATABASE_URL is set', async () => {
    process.env.DATABASE_URL = 'postgresql://fake:5432/test'

    const { getBoss } = await import('../lib/queue/boss')
    const boss = await getBoss()
    expect(boss).toBeDefined()
    expect(typeof boss.send).toBe('function')
  })

  it('returns the same instance on second call (singleton)', async () => {
    process.env.DATABASE_URL = 'postgresql://fake:5432/test'

    const { getBoss } = await import('../lib/queue/boss')
    const boss1 = await getBoss()
    const boss2 = await getBoss()
    expect(boss1).toBe(boss2)
  })
})
