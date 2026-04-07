// lib/scrapers/index.ts
// Registry stub for available scraper adapters.
// OlxScraper will be registered here in Plan 03 when the OlxScraper class is built.

import type { ScraperAdapter } from './types'

/**
 * Returns all registered scraper adapters.
 * Currently empty — OlxScraper added in Phase 2 Plan 03.
 */
export function getAvailableScrapers(): ScraperAdapter[] {
  return []
}
