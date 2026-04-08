// tests/scrapers/google-maps-scraper.test.ts
// Unit tests for Google Maps Places API scraper and schema extension.
// Tests cover: RawLeadSchema sourcePlatform extension, GoogleMapsScraper behavior, registry.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RawLeadSchema } from '@/lib/scrapers/types'
import type { ScraperConfig } from '@/lib/scrapers/types'

// Mock got before importing the scraper
// Must include extend() for OlxScraper module-level call
vi.mock('got', () => {
  const mockPost = vi.fn()
  const mockGot = {
    post: mockPost,
    extend: vi.fn().mockReturnValue({
      get: vi.fn(),
    }),
  }
  return {
    default: mockGot,
  }
})

// Mock delayWithJitter to avoid actual delays in tests, preserve OlxScraper for registry
vi.mock('@/lib/scrapers/olx/olx-scraper', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    delayWithJitter: vi.fn().mockResolvedValue(undefined),
  }
})

// Set API key for tests (got is mocked, so no real API calls)
process.env.GOOGLE_MAPS_API_KEY = 'test-api-key'

const baseValidLead = {
  sourceUrl: 'https://example.com/shop',
  name: 'Test Shop',
  phone: '+48123456789',
  email: null,
  city: 'Warszawa',
  description: 'Rating: 4.5/5 (100 reviews)',
  categories: ['art_gallery'],
  priceMin: null,
  priceMax: null,
  socialLinks: { website: 'https://example.com/shop' },
  sellerType: 'business' as const,
  listingCount: null,
  scrapedAt: new Date().toISOString(),
}

const defaultConfig: ScraperConfig = {
  categories: [],
  cities: ['Warszawa'],
  keywords: ['handmade'],
  maxPages: 3,
  delayMs: 100,
  jitterMs: 0,
  concurrency: 1,
}

describe('RawLeadSchema sourcePlatform extension', () => {
  it('Test 1: accepts sourcePlatform google_maps', () => {
    const lead = { ...baseValidLead, sourcePlatform: 'google_maps' }
    const result = RawLeadSchema.parse(lead)
    expect(result.sourcePlatform).toBe('google_maps')
  })

  it('Test 2: accepts sourcePlatform olx (regression)', () => {
    const lead = { ...baseValidLead, sourcePlatform: 'olx' }
    const result = RawLeadSchema.parse(lead)
    expect(result.sourcePlatform).toBe('olx')
  })

  it('Test 3: rejects invalid sourcePlatform facebook', () => {
    const lead = { ...baseValidLead, sourcePlatform: 'facebook' }
    expect(() => RawLeadSchema.parse(lead)).toThrow()
  })
})

describe('GoogleMapsScraper', () => {
  let got: { post: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    const gotModule = await import('got')
    got = gotModule.default as unknown as { post: ReturnType<typeof vi.fn> }
  })

  it('Test 4: run() returns RawLead[] with sourcePlatform google_maps', async () => {
    got.post.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        places: [
          {
            displayName: { text: 'Handmade Shop', languageCode: 'pl' },
            formattedAddress: 'ul. Marszalkowska 1, 00-001 Warszawa, Polska',
            nationalPhoneNumber: '+48 123 456 789',
            websiteUri: 'https://handmade-shop.pl',
            types: ['art_gallery', 'store'],
            rating: 4.5,
            userRatingCount: 100,
          },
        ],
        // no nextPageToken = single page
      }),
    })

    const { GoogleMapsScraper } = await import('@/lib/scrapers/google-maps/google-maps-scraper')
    const scraper = new GoogleMapsScraper(defaultConfig)
    const leads = await scraper.run(defaultConfig)

    expect(leads.length).toBeGreaterThan(0)
    expect(leads[0].sourcePlatform).toBe('google_maps')
    expect(leads[0].name).toBe('Handmade Shop')
    expect(leads[0].phone).toBe('+48 123 456 789')
    expect(leads[0].sourceUrl).toBe('https://handmade-shop.pl')
  })

  it('Test 5: run() handles pagination (nextPageToken present then absent)', async () => {
    // Page 1: has nextPageToken
    const page1Response = {
      json: vi.fn().mockResolvedValue({
        places: [
          {
            displayName: { text: 'Shop 1', languageCode: 'pl' },
            formattedAddress: 'Warszawa, Polska',
            websiteUri: 'https://shop1.pl',
            types: ['store'],
          },
        ],
        nextPageToken: 'token123',
      }),
    }

    // Page 2: no nextPageToken
    const page2Response = {
      json: vi.fn().mockResolvedValue({
        places: [
          {
            displayName: { text: 'Shop 2', languageCode: 'pl' },
            formattedAddress: 'Warszawa, Polska',
            websiteUri: 'https://shop2.pl',
            types: ['store'],
          },
        ],
        // no nextPageToken = stop
      }),
    }

    got.post
      .mockReturnValueOnce(page1Response)
      .mockReturnValueOnce(page2Response)

    const { GoogleMapsScraper } = await import('@/lib/scrapers/google-maps/google-maps-scraper')
    const scraper = new GoogleMapsScraper(defaultConfig)
    const leads = await scraper.run(defaultConfig)

    expect(leads.length).toBe(2)
    expect(leads[0].name).toBe('Shop 1')
    expect(leads[1].name).toBe('Shop 2')
    expect(got.post).toHaveBeenCalledTimes(2)
  })

  it('Test 6: run() returns empty array when Places API returns no results', async () => {
    got.post.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        places: [],
      }),
    })

    const { GoogleMapsScraper } = await import('@/lib/scrapers/google-maps/google-maps-scraper')
    const scraper = new GoogleMapsScraper(defaultConfig)
    const leads = await scraper.run(defaultConfig)

    expect(leads).toEqual([])
  })
})

describe('Scraper registry', () => {
  it('Test 7: createScraper google_maps returns a GoogleMapsScraper instance', async () => {
    const { createScraper } = await import('@/lib/scrapers/index')
    const { GoogleMapsScraper } = await import('@/lib/scrapers/google-maps/google-maps-scraper')
    const scraper = createScraper('google_maps', defaultConfig)
    expect(scraper).toBeInstanceOf(GoogleMapsScraper)
  })

  it('Test 8: createScraper google_maps .name equals google_maps', async () => {
    const { createScraper } = await import('@/lib/scrapers/index')
    const scraper = createScraper('google_maps', defaultConfig)
    expect(scraper.name).toBe('google_maps')
  })
})
