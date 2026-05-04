// lib/scrapers/types.ts
// Scraper type contracts for the Seed Round Pipeline scraping system.
// All scrapers must implement ScraperAdapter. All raw scraped data must
// pass RawLeadSchema.parse() before entering the normalization pipeline (T-02-01).

import { z } from 'zod'

export interface ScraperConfig {
  categories: string[]
  cities: string[]
  keywords: string[]
  maxPages: number
  delayMs: number
  jitterMs: number
  concurrency: number
  revealPhones?: boolean  // OLX-specific: launch Playwright per listing
}

export interface RawLead {
  sourceUrl: string
  sourcePlatform: 'olx' | 'google_maps' | 'instagram'
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  description: string | null
  categories: string[]
  priceMin: number | null
  priceMax: number | null
  socialLinks: Record<string, string>
  sellerType: 'private' | 'business' | 'unknown'
  listingCount: number | null
  thumbnailUrl: string | null
  photos: string[]
  scrapedAt: string
}

// Zod schema — enforces the trust boundary between scraper output and pipeline (T-02-01).
export const RawLeadSchema = z.object({
  sourceUrl: z.string().url(),
  sourcePlatform: z.enum(['olx', 'google_maps', 'instagram']),
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
  thumbnailUrl: z.string().url().nullable(),
  photos: z.array(z.string().url()),
  scrapedAt: z.string().datetime(),
})

export type RawLeadOutput = z.output<typeof RawLeadSchema>

export interface ScraperAdapter {
  name: string
  run(config: ScraperConfig): Promise<RawLead[]>
}

export interface ScraperResult {
  created: number
  duplicate: number
  errors: number
}
