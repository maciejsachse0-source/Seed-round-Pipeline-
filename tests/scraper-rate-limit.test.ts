// tests/scraper-rate-limit.test.ts
// Tests for the delayWithJitter rate limiting utility.

import { describe, it, expect } from 'vitest'
import { delayWithJitter } from '../lib/scrapers/olx/olx-scraper'

describe('delayWithJitter', () => {
  it('resolves after at least baseMs (3000ms base, 1000ms jitter)', async () => {
    const start = Date.now()
    await delayWithJitter(3000, 1000)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(2900) // 100ms tolerance for timer inaccuracy
  }, 10000)

  it('resolves before baseMs + jitterMs + 100ms tolerance (3000ms base, 1000ms jitter)', async () => {
    const start = Date.now()
    await delayWithJitter(3000, 1000)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(4100) // max = 3000 + 1000 + 100ms tolerance
  }, 10000)

  it('resolves near-instantly when both base and jitter are 0', async () => {
    const start = Date.now()
    await delayWithJitter(0, 0)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(50) // should complete in <50ms
  })
})
