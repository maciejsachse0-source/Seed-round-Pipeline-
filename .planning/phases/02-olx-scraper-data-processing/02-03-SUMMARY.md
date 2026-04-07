---
phase: 02-olx-scraper-data-processing
plan: "03"
subsystem: scraping
tags: [olx, cheerio, playwright, got, rate-limiting, html-parsing]
dependency_graph:
  requires: [02-01]
  provides: [OlxScraper, olx-parser, olx-phone, olx-selectors, scraper-registry]
  affects: [lib/scrapers/index.ts, lib/scrapers/olx/]
tech_stack:
  added: [cheerio, got, playwright-extra, puppeteer-extra-plugin-stealth, p-limit]
  patterns: [ScraperAdapter, TDD-with-HTML-fixtures, centralized-selectors, delayWithJitter]
key_files:
  created:
    - lib/scrapers/olx/olx-selectors.ts
    - lib/scrapers/olx/olx-parser.ts
    - lib/scrapers/olx/olx-phone.ts
    - lib/scrapers/olx/olx-scraper.ts
    - tests/olx-parser.test.ts
    - tests/scraper-rate-limit.test.ts
    - tests/fixtures/olx-listing-index.html
    - tests/fixtures/olx-listing-detail.html
    - tests/fixtures/olx-listing-detail-business.html
  modified:
    - lib/scrapers/index.ts
decisions:
  - "OLX_SELECTORS centralized in olx-selectors.ts — all selectors in one file for easy maintenance when OLX changes their HTML structure"
  - "delayWithJitter exported from olx-scraper.ts (not a separate utils file) — avoids extra module for a single function"
  - "listingCount set to null — OLX does not expose per-seller listing counts on individual listing pages"
  - "parseListingDetail returns sellerType 'private' as default when seller badge text is unrecognized (not 'unknown') — most OLX handmade sellers are private"
metrics:
  duration: "5 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 02 Plan 03: OLX Scraper Core Engine Summary

OLX scraper built with Cheerio HTML parsing, configurable rate limiting via delayWithJitter, Playwright stealth phone reveal, and OlxScraper class implementing ScraperAdapter — all selectors centralized in olx-selectors.ts.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | OLX selectors, Cheerio HTML parser with fixtures, rate limiting | 57c0696 |
| 2 | OlxScraper class, phone reveal module, scraper registry | 4601e0d |

## What Was Built

### olx-selectors.ts
Centralized CSS selector constants (15 selectors) for all OLX.pl page elements. Selectors are marked as `[ASSUMED]` — they must be verified against live OLX pages during the first real scrape run. Single-file change pattern for maintainability.

### olx-parser.ts
Two pure Cheerio parsing functions:
- `parseListingIndex(html)` — parses category/search index pages, returns `[{url, title}]`, normalizes relative URLs to absolute
- `parseListingDetail(html)` — parses detail pages, extracts name, city, description, categories (from breadcrumbs), price (handles Polish number format with space thousands separator), sellerType (business/private detection via "Firma" keyword), and socialLinks (regex extraction of facebook.com/instagram.com URLs from description)

### olx-phone.ts
Playwright + stealth phone reveal: `revealPhone(url)` launches Chromium with puppeteer-extra-plugin-stealth, navigates to listing, clicks the phone reveal button, extracts the phone number. try/finally guarantees `browser.close()` always runs (T-02-08 mitigation). Returns null (never throws) on any error.

### olx-scraper.ts
`OlxScraper` class implementing `ScraperAdapter`:
- Iterates category × city × keyword × page combinations
- Uses `got` with browser-like headers and retry on 429/503
- Detects 403 response and stops immediately (T-02-07 mitigation)
- `delayWithJitter(baseMs, jitterMs)` exported for rate limiting tests
- `p-limit` caps concurrent Playwright browser contexts
- Empty listings array signals last page (pagination stop condition)

### lib/scrapers/index.ts
`getAvailableScrapers()` and `createScraper(platform, config)` factory. OLX registered. Ready for future scraper platforms (Facebook, Instagram, Google Maps).

### Test Coverage
- 12 tests in `olx-parser.test.ts`: index parsing, URL normalization, name/city/price/category extraction, private/business seller detection, social link extraction
- 3 tests in `scraper-rate-limit.test.ts`: minimum delay enforcement, maximum delay bound, near-instant completion at 0ms
- Full test suite: 61/61 tests pass

## Deviations from Plan

None - plan executed exactly as written.

The plan specified `delayWithJitter` could be in "olx-scraper.ts (or a shared utils file)" — placed in olx-scraper.ts as both Task 1 (rate-limit tests) and Task 2 (scraper) need it and a separate utils file was not warranted.

## Known Stubs

None. All parser functions return real extracted data from HTML.

`listingCount: null` is intentional and documented — OLX does not expose per-seller listing counts on individual listing pages. This field will remain null for OLX-sourced leads (it is designed as `number | null` in RawLead).

## Threat Surface

No new threat surface beyond what the plan's threat model already covers (T-02-06 through T-02-09). All mitigations are implemented:
- Cheerio parses HTML safely without JS execution (T-02-06)
- p-limit(1) + 403 detection prevents DoS from concurrent requests (T-02-07)
- try/finally browser.close() + 15s timeout (T-02-08)
- Static UA header (T-02-09, accepted)

## Self-Check: PASSED

All files verified to exist and both commits confirmed in git log.
