// lib/scrapers/types.ts
// Scraper type contracts for the Seed Round Pipeline scraping system.
// All scrapers must implement ScraperAdapter. All raw scraped data must
// pass RawLeadSchema.parse() before entering the normalization pipeline (T-02-01).

import { z } from 'zod'

export interface ScraperConfig {
  categories: string[]    // e.g. ['antyki-i-kolekcje/rekodzielo', 'dom-ogrod/wyposazenie-wnetrz/dekoracje']
  cities: string[]        // e.g. ['warszawa', 'krakow', ''] — empty string = all Poland
  keywords: string[]      // e.g. ['handmade', 'rekodzielniczy'] — appended as /q-{keyword}/
  maxPages: number        // page limit per category+city combination
  delayMs: number         // base delay between requests in ms (default 3000)
  jitterMs: number        // random jitter added to delay (default 1000)
  concurrency: number     // max parallel Playwright contexts (default 1)
}

export interface RawLead {
  sourceUrl: string
  sourcePlatform: 'olx' | 'google_maps'
  name: string | null
  phone: string | null
  email: string | null          // OLX: almost always null — in-platform messaging only
  city: string | null
  description: string | null
  categories: string[]
  priceMin: number | null
  priceMax: number | null
  socialLinks: Record<string, string>
  sellerType: 'private' | 'business' | 'unknown'
  listingCount: number | null
  scrapedAt: string             // ISO 8601 datetime string
}

// Zod schema for validating scraped data before it enters the normalization pipeline.
// Enforces the trust boundary: OLX HTML -> scraper (T-02-01).
export const RawLeadSchema = z.object({
  sourceUrl: z.string().url(),
  sourcePlatform: z.enum(['olx', 'google_maps']),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  city: z.string().nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  socialLinks: z.record(z.string(), z.string()),
  sellerType: z.enum(['private', 'business', 'unknown']),
  listingCount: z.number().int().nullable(),
  scrapedAt: z.string().datetime(),
})

export type RawLeadOutput = z.output<typeof RawLeadSchema>

// ScraperAdapter: all platform scrapers must implement this interface.
// Allows OlxScraper (Phase 2) and future scrapers (Phase 6) to plug into
// the same pipeline without changes.
export interface ScraperAdapter {
  name: string
  run(config: ScraperConfig): Promise<RawLead[]>
}

// ScraperResult: summary returned after processing a batch of raw leads.
export interface ScraperResult {
  created: number
  duplicate: number
  errors: number
}
