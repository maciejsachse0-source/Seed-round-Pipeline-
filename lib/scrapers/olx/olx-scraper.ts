// lib/scrapers/olx/olx-scraper.ts
// OlxScraper: implements ScraperAdapter using got for HTTP and Cheerio for parsing.
// Phone reveal is delegated to olx-phone.ts (Playwright+stealth).
// Rate limiting uses configurable delayMs + jitterMs from ScraperConfig (SCRP-05).
// Concurrency is capped via p-limit to prevent resource exhaustion (T-02-07).

import got from 'got'
import pLimit from 'p-limit'
import type { ScraperAdapter, ScraperConfig, RawLead } from '../types'
import { buildListingUrl } from './olx-urls'
import { parseListingIndex, parseListingDetail } from './olx-parser'
import { revealPhone } from './olx-phone'

/**
 * Adds a configurable delay with random jitter to space out requests.
 * Implements SCRP-05: rate limiting with jitter to avoid predictable patterns.
 *
 * @param baseMs  - Minimum delay in milliseconds
 * @param jitterMs - Maximum additional random delay in milliseconds
 */
export async function delayWithJitter(baseMs: number, jitterMs: number): Promise<void> {
  const delay = baseMs + Math.random() * jitterMs
  await new Promise<void>(resolve => setTimeout(resolve, delay))
}

// HTTP client configured for OLX.pl scraping with browser-like headers
// and automatic retry on rate limit / server error responses (T-02-07)
const httpClient = got.extend({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
  },
  retry: { limit: 2, statusCodes: [429, 503] },
  timeout: { request: 15000 },
})

/**
 * OlxScraper: scrapes OLX.pl handmade/craft seller listings.
 * Implements ScraperAdapter to integrate with the broader pipeline.
 *
 * Workflow per category+city+keyword combination:
 * 1. Fetch listing index pages with got (static HTML, Cheerio parsing)
 * 2. For each listing URL, fetch the detail page and extract RawLead fields
 * 3. Attempt phone reveal via Playwright stealth (optional — null if unavailable)
 * 4. Enforce rate limiting (delayMs + jitterMs) between all requests
 * 5. Cap concurrency with p-limit to avoid opening too many browser contexts
 */
export class OlxScraper implements ScraperAdapter {
  name = 'olx'

  async run(config: ScraperConfig): Promise<RawLead[]> {
    const leads: RawLead[] = []
    const limit = pLimit(config.concurrency || 1)

    for (const category of config.categories) {
      for (const city of config.cities) {
        // Allow empty keywords array — iterate without keyword segment if empty
        const keywords = config.keywords.length > 0 ? config.keywords : ['']

        for (const keyword of keywords) {
          for (let page = 1; page <= config.maxPages; page++) {
            await delayWithJitter(config.delayMs, config.jitterMs)

            const url = buildListingUrl(category, city, keyword, page)

            let listings: Array<{ url: string; title: string }>

            try {
              const response = await httpClient.get(url)

              // 403 means OLX has detected and blocked the scraper — stop immediately (T-02-07)
              if (response.statusCode === 403) {
                console.error(`[olx-scraper] 403 Forbidden at ${url} — stopping scrape`)
                return leads
              }

              listings = parseListingIndex(response.body as string)
            } catch (err) {
              console.error(`[olx-scraper] Failed to fetch index page ${url}:`, err)
              continue
            }

            // No listings on this page = past the last page for this combination
            if (listings.length === 0) break

            const detailPromises = listings.map(listing =>
              limit(async () => {
                await delayWithJitter(config.delayMs, config.jitterMs)

                try {
                  const detailResponse = await httpClient.get(listing.url)
                  const partial = parseListingDetail(detailResponse.body as string)

                  // Phone reveal is expensive (~15s per listing, launches full browser).
                  // Skip by default — enable via config.revealPhones: true
                  const phone = config.revealPhones
                    ? await revealPhone(listing.url)
                    : null

                  const rawLead: RawLead = {
                    sourceUrl: listing.url,
                    sourcePlatform: 'olx',
                    name: partial.name ?? null,
                    phone,
                    email: null, // OLX does not expose email addresses (in-platform messaging only)
                    city: partial.city ?? null,
                    description: partial.description ?? null,
                    categories: partial.categories ?? [],
                    priceMin: partial.priceMin ?? null,
                    priceMax: partial.priceMax ?? null,
                    socialLinks: partial.socialLinks ?? {},
                    sellerType: partial.sellerType ?? 'unknown',
                    listingCount: null,
                    thumbnailUrl: (partial as { thumbnailUrl?: string }).thumbnailUrl ?? null,
                    photos: (partial as { photos?: string[] }).photos ?? [],
                    scrapedAt: new Date().toISOString(),
                  }

                  leads.push(rawLead)
                } catch (err) {
                  console.error(`[olx-scraper] Failed to scrape detail page ${listing.url}:`, err)
                }
              })
            )

            await Promise.all(detailPromises)
          }
        }
      }
    }

    return leads
  }
}
