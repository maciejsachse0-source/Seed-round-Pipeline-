// lib/scrapers/index.ts
// Scraper registry — maps platform names to their ScraperAdapter implementations.
// Add new scraper platforms here as they are built in future phases.

import type { ScraperAdapter, ScraperConfig } from './types'
import { OlxScraper } from './olx/olx-scraper'
import { GoogleMapsScraper } from './google-maps/google-maps-scraper'
import { InstagramScraper } from './instagram/instagram-scraper'

// Map of platform name -> constructor for each registered scraper adapter
const SCRAPERS: Record<string, new (config: ScraperConfig) => ScraperAdapter> = {
  olx: OlxScraper,
  google_maps: GoogleMapsScraper,
  instagram: InstagramScraper,
}

/**
 * Returns the list of available scraper platform names.
 */
export function getAvailableScrapers(): string[] {
  return Object.keys(SCRAPERS)
}

/**
 * Creates and returns a ScraperAdapter for the specified platform.
 * Throws an error if the platform is not registered.
 *
 * @param platform - Platform identifier (e.g. 'olx')
 * @param config   - ScraperConfig for this scrape run
 */
export function createScraper(platform: string, config: ScraperConfig): ScraperAdapter {
  const Scraper = SCRAPERS[platform]
  if (!Scraper) {
    throw new Error(`Unknown scraper platform: "${platform}". Available: ${Object.keys(SCRAPERS).join(', ')}`)
  }
  return new Scraper(config)
}
