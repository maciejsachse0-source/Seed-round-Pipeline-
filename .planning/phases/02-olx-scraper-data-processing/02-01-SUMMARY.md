---
phase: 02-olx-scraper-data-processing
plan: "01"
subsystem: scraper-foundation
tags: [migration, types, zod, url-builder, tdd, supabase]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [scraper-type-contracts, email-nullable-migration, olx-url-builder, raw-lead-zod-schema]
  affects: [02-02, 02-03, 02-04, 02-05]
tech_stack:
  added: [got, cheerio, playwright, playwright-extra, puppeteer-extra-plugin-stealth, p-limit, libphonenumber-js]
  patterns: [scraper-adapter-interface, zod-boundary-validation, tdd-red-green, conditional-unique-indexes]
key_files:
  created:
    - supabase/migrations/20260407000001_olx_nullable_email.sql
    - lib/scrapers/types.ts
    - lib/scrapers/olx/olx-urls.ts
    - lib/scrapers/index.ts
    - tests/olx-urls.test.ts
    - tests/scraper-validation.test.ts
  modified:
    - lib/db/types.ts
    - package.json
    - package-lock.json
decisions:
  - "email-nullable: Lead.email changed to string | null — OLX uses in-platform messaging, no email field exposed on listing pages"
  - "conditional-unique-index: phone unique WHERE NOT NULL — allows multiple null phones (no email = phone is primary contact)"
  - "source_url-dedup-index: prevents duplicate insertion on re-scrape of same OLX listing (T-02-02 mitigation)"
  - "zod-at-boundary: RawLeadSchema.parse() is the single validation gate before normalization pipeline (T-02-01 mitigation)"
  - "scraper-registry-stub: lib/scrapers/index.ts returns [] until OlxScraper built in Plan 03"
metrics:
  duration: "8 min"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 9
---

# Phase 2 Plan 01: Scraper Foundation — Dependencies, Schema Migration, Type Contracts Summary

**One-liner:** Email-nullable migration applied to live Supabase, ScraperAdapter/RawLead/RawLeadSchema type system defined with Zod boundary validation, OLX URL builder with TDD coverage (14 new tests, 46 total passing).

---

## What Was Built

### Task 1: Phase 2 Dependencies + Email-Nullable Migration

Installed all Phase 2 scraping dependencies (`got`, `cheerio`, `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `p-limit`, `libphonenumber-js`) and created + applied the critical schema migration to the live Supabase project (uwuicdilargmuvhfdwue).

Migration `20260407000001_olx_nullable_email.sql` makes three schema changes:
1. `ALTER TABLE leads ALTER COLUMN email DROP NOT NULL` — allows OLX leads with no email
2. `CREATE UNIQUE INDEX idx_leads_phone_unique ON leads (phone) WHERE phone IS NOT NULL` — deduplication by phone without blocking multiple null phones
3. `CREATE UNIQUE INDEX idx_leads_source_url ON leads (source_url) WHERE source_url IS NOT NULL` — prevents re-scraping same listing from creating duplicates

Both indexes verified live via `supabase db query --linked`.

### Task 2: Scraper Type Contracts + URL Builder (TDD)

**lib/db/types.ts:** `Lead.email` updated from `string` to `string | null` to match the migration.

**lib/scrapers/types.ts:** Full type system for the scraping pipeline:
- `ScraperConfig` — categories, cities, keywords, maxPages, delayMs, jitterMs, concurrency
- `RawLead` — all scraped fields including nullable email/phone, sellerType enum, ISO scrapedAt
- `RawLeadSchema` — Zod schema enforcing the trust boundary: sourceUrl as URL, sourcePlatform as `'olx'` literal, sellerType as enum, scrapedAt as ISO datetime, email nullable with email format when present
- `ScraperAdapter` — interface all platform scrapers must implement (name + run method)
- `ScraperResult` — summary counts for created/duplicate/errors

**lib/scrapers/olx/olx-urls.ts:** `buildListingUrl(category, city, keyword, page)` constructing correct OLX.pl URLs. City and keyword segments are conditional; `?page=N` only appended when page > 1.

**lib/scrapers/index.ts:** Registry stub returning empty array (populated in Plan 03).

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| tests/olx-urls.test.ts | 8 | PASS |
| tests/scraper-validation.test.ts | 6 | PASS |
| tests/queue.test.ts | 8 | PASS (Phase 1) |
| tests/state-machine.test.ts | 25 | PASS (Phase 1) |
| tests/suppression.test.ts | 4 | PASS (Phase 1) |
| **Total** | **46** | **ALL PASS** |

TypeScript: `npx tsc --noEmit` — clean.

---

## Commits

| Hash | Message |
|------|---------|
| 4b2677d | feat(02-01): install Phase 2 deps and apply email-nullable migration |
| 294a9b7 | test(02-01): add failing tests for URL builder and Zod schema validation (RED) |
| 23557b3 | feat(02-01): define scraper type contracts, Zod schema, URL builder, update Lead.email |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

- `lib/scrapers/index.ts` — `getAvailableScrapers()` returns `[]`. Intentional stub; OlxScraper registered in Plan 03 when the scraper class is built. Does not block this plan's goal.

---

## Threat Surface Scan

All security mitigations from the plan's threat model are implemented:
- **T-02-01** (Tampering via RawLeadSchema): `RawLeadSchema.parse()` defined in `lib/scrapers/types.ts` with full field validation.
- **T-02-02** (Tampering via unique indexes): Both `idx_leads_phone_unique` and `idx_leads_source_url` conditional unique indexes applied and verified in live DB.
- **T-02-03** (Information Disclosure via olx-urls.ts): URL construction is deterministic from public OLX category paths; no secrets or PII in module.

No new threat surface introduced beyond what the plan's threat model covers.

---

## Self-Check: PASSED

All 6 key files exist on disk. All 3 task commits verified in git log. 46 tests pass. TypeScript compiles cleanly.
