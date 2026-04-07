---
phase: 02-olx-scraper-data-processing
verified: 2026-04-06T12:32:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run a live OLX scrape job via POST /api/scrape with a real category and location"
    expected: "Lead records appear in Supabase with name, phone, city, description, categories, price_range, social_links, score, source_platform, source_url populated; scrape_jobs row shows status=completed with leads_found/leads_new/leads_duplicate counts"
    why_human: "Cannot verify actual Supabase DB write without a running server and live OLX access; requires network I/O, Playwright Chromium browser, and live Supabase credentials"
  - test: "Verify OLX CSS selectors match live OLX.pl HTML structure"
    expected: "parseListingIndex and parseListingDetail correctly extract data from real OLX pages (not just test fixtures)"
    why_human: "All selectors in olx-selectors.ts are explicitly marked [ASSUMED]; they must be validated against live OLX HTML during the first real scrape run"
---

# Phase 2: OLX Scraper + Data Processing Verification Report

**Phase Goal:** Scraped handmade seller leads from OLX appear in the Supabase database — normalized, deduplicated, and scored — ready for human review.
**Verified:** 2026-04-06T12:32:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running an OLX scrape job for a given category + location produces lead records in Supabase with all required fields | ? HUMAN NEEDED | Full pipeline wired (POST /api/scrape -> pg-boss -> OlxScraper -> ingest -> Supabase); cannot verify DB write without live environment |
| 2 | Submitting duplicate leads (same email or phone) does not create duplicate records | ✓ VERIFIED | lib/pipeline/deduplicate.ts implements three-tier dedup (source_url upsert -> email upsert -> phone check-then-insert); 5 tests pass; DB has conditional unique indexes (source_url, phone) |
| 3 | Polish characters, phone number formats, and city names are normalized consistently | ✓ VERIFIED | lib/pipeline/normalize.ts: normalizePolishPhone (E.164 via libphonenumber-js), normalizeCity (10 canonical aliases), normalizePolishText (NFC trim); 20 normalization tests pass |
| 4 | Each lead has a numeric score 0-100 stored in Supabase | ✓ VERIFIED | lib/pipeline/score.ts: scoreLead produces 0-100 integer via 5 weighted dimensions (SCORING_WEIGHTS sum to 100); ingest.ts calls scoreLead and writes score to DB column; 11 scoring tests pass |
| 5 | The scraper respects configurable rate limits | ✓ VERIFIED | delayWithJitter(baseMs, jitterMs) in olx-scraper.ts called before every request; ScraperConfig.delayMs and jitterMs control timing; p-limit caps concurrency; 3 rate-limit tests pass |

**Score:** 4/5 truths fully verified programmatically (1 requires human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260407000001_olx_nullable_email.sql` | Email nullable migration + phone/source_url unique indexes | ✓ VERIFIED | Contains `ALTER TABLE leads ALTER COLUMN email DROP NOT NULL` and both conditional unique indexes |
| `lib/scrapers/types.ts` | ScraperConfig, RawLead, RawLeadSchema, ScraperAdapter, ScraperResult | ✓ VERIFIED | All 5 exports present; RawLeadSchema uses z.object with all fields including url validation, literal 'olx', sellerType enum, datetime |
| `lib/scrapers/olx/olx-urls.ts` | buildListingUrl, HANDMADE_CATEGORIES | ✓ VERIFIED | Both exported; HANDMADE_CATEGORIES has exactly 4 entries; URL construction logic is correct |
| `lib/scrapers/olx/olx-selectors.ts` | OLX_SELECTORS centralized | ✓ VERIFIED | 15 selectors (exceeds requirement of 10); all marked [ASSUMED] — requires live OLX validation |
| `lib/scrapers/olx/olx-parser.ts` | parseListingIndex, parseListingDetail | ✓ VERIFIED | Both exported; imports cheerio and olx-selectors; social link extraction via regex; business/private detection via "Firma" keyword; 12 parser tests pass |
| `lib/scrapers/olx/olx-phone.ts` | revealPhone with Playwright stealth | ✓ VERIFIED | Exports revealPhone; imports from playwright-extra and puppeteer-extra-plugin-stealth; try/finally guarantees browser.close() |
| `lib/scrapers/olx/olx-scraper.ts` | OlxScraper implementing ScraperAdapter | ✓ VERIFIED | OlxScraper class with `implements ScraperAdapter`; imports got, pLimit, buildListingUrl, parseListingIndex, parseListingDetail, revealPhone; 403 detection stops scrape; delayWithJitter exported |
| `lib/scrapers/index.ts` | getAvailableScrapers, createScraper | ✓ VERIFIED | Both exported; OlxScraper registered as 'olx'; createScraper factory throws for unknown platforms |
| `lib/pipeline/normalize.ts` | normalizePolishPhone, normalizeCity, normalizePolishText | ✓ VERIFIED | All 3 exported; libphonenumber-js import confirmed; isPossiblePhoneNumber double-check prevents false positives |
| `lib/pipeline/score.ts` | scoreLead, ScoringSignals, SCORING_WEIGHTS | ✓ VERIFIED | All 3 exported; SCORING_WEIGHTS values sum to 100; output clamped with Math.min(100, Math.round(score)) |
| `lib/pipeline/deduplicate.ts` | upsertLead with three-tier dedup | ✓ VERIFIED | Exported; uses supabase.from('leads').upsert with onConflict and ignoreDuplicates; phone check-then-insert pattern |
| `lib/pipeline/ingest.ts` | ingestRawLeads pipeline orchestrator | ✓ VERIFIED | Exported; imports from normalize, score, deduplicate, scrapers/types; calls RawLeadSchema.parse(); maps description->business_description, priceMin/priceMax->price_range |
| `lib/queue/workers/scrape-worker.ts` | registerScrapeWorker pg-boss worker | ✓ VERIFIED | Exported; calls boss.work('scrape-olx'); updates scrape_jobs status running/completed/failed with leads_found/leads_new/leads_duplicate |
| `app/api/scrape/route.ts` | POST route to dispatch scrape jobs | ✓ VERIFIED | POST handler exported; validates config.categories non-empty (400); creates scrape_jobs record; dispatches boss.send('scrape-olx', config, { id: job.id }); returns 201 { jobId } |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| lib/scrapers/types.ts | lib/db/types.ts | RawLead maps to Lead type | ✓ WIRED | Lead.email is `string \| null` matching nullable migration; field names align |
| lib/scrapers/olx/olx-scraper.ts | lib/scrapers/types.ts | implements ScraperAdapter | ✓ WIRED | `implements ScraperAdapter` present; run(config: ScraperConfig): Promise<RawLead[]> signature matches |
| lib/scrapers/olx/olx-scraper.ts | got | HTTP requests | ✓ WIRED | `import got from 'got'`; httpClient.get() used for index and detail pages |
| lib/scrapers/olx/olx-phone.ts | playwright-extra | stealth browser | ✓ WIRED | `import { chromium } from 'playwright-extra'`; `import StealthPlugin from 'puppeteer-extra-plugin-stealth'` |
| lib/pipeline/ingest.ts | lib/pipeline/normalize.ts | normalize calls | ✓ WIRED | `import { normalizePolishPhone, normalizeCity, normalizePolishText } from './normalize'`; all 3 called on each lead |
| lib/pipeline/ingest.ts | lib/pipeline/score.ts | scoreLead call | ✓ WIRED | `import { scoreLead, type ScoringSignals } from './score'`; scoreLead(signals) called on each lead |
| lib/pipeline/ingest.ts | lib/pipeline/deduplicate.ts | upsertLead call | ✓ WIRED | `import { upsertLead } from './deduplicate'`; upsertLead(dbLead) called with result counted |
| lib/queue/workers/scrape-worker.ts | lib/pipeline/ingest.ts | ingestRawLeads call | ✓ WIRED | `import { ingestRawLeads } from '@/lib/pipeline/ingest'`; ingestRawLeads(rawLeads, job.id) called in worker |
| instrumentation.ts | lib/queue/workers/scrape-worker.ts | registerScrapeWorker at startup | ✓ WIRED | `import('./lib/queue/workers/scrape-worker')` and `await registerScrapeWorker()` present inside NEXT_RUNTIME nodejs block |
| app/api/scrape/route.ts | lib/queue/boss.ts | boss.send('scrape-olx') | ✓ WIRED | `import { getBoss } from '@/lib/queue/boss'`; `boss.send('scrape-olx', config, { id: job.id })` present |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| lib/pipeline/ingest.ts | rawLeads | OlxScraper.run() via scrape-worker.ts | Yes — scraper fetches real HTML, parses lead fields | ✓ FLOWING |
| lib/pipeline/ingest.ts | dbLead | normalize + score applied to validated RawLead | Yes — phone/city/text normalized, score computed from 5 signals | ✓ FLOWING |
| lib/pipeline/deduplicate.ts | upsertLead result | supabase.from('leads').upsert with real DB query | Yes — Supabase upsert with onConflict; returns created/duplicate based on DB response | ✓ FLOWING |
| app/api/scrape/route.ts | job.id | supabase.from('scrape_jobs').insert().select('id').single() | Yes — DB insert returns real UUID | ✓ FLOWING |

Note: Live DB write (ingest completing successfully) requires human verification — see Human Verification Required section.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 104 tests pass | npx vitest run | 104 passed (11 files) | ✓ PASS |
| TypeScript compiles clean | npx tsc --noEmit | No output (zero errors) | ✓ PASS |
| All documented commits exist | git log verification | All 11 Phase 2 feature/test commits found | ✓ PASS |
| POST /api/scrape returns 400 for empty categories | Code inspection | `if (!config.categories?.length)` check returns 400 | ✓ PASS |
| revealPhone never throws | Code inspection | try/catch returns null on any error; finally closes browser | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRP-01 | 02-03 | System scrapuje listingi handmade z OLX (Playwright + stealth) | ✓ SATISFIED | OlxScraper uses got for HTTP + Cheerio for parsing; revealPhone uses playwright-extra + stealth plugin; implements ScraperAdapter |
| SCRP-03 | 02-01 | Konfigurowalne parametry wyszukiwania (kategoria, lokalizacja, słowa kluczowe) | ✓ SATISFIED | ScraperConfig has categories[], cities[], keywords[], maxPages in types.ts; OlxScraper iterates all combinations |
| SCRP-04 | 02-01 | Scraped data walidowana przez Zod schema | ✓ SATISFIED | RawLeadSchema in types.ts; ingest.ts calls RawLeadSchema.parse() at trust boundary; 6 validation tests pass |
| SCRP-05 | 02-03 | Rate limits respektowane (konfigurowalne opóźnienia) | ✓ SATISFIED | delayWithJitter(config.delayMs, config.jitterMs) called before every request; p-limit for concurrency; 3 rate-limit tests pass |
| DATA-01 | 02-04 | Deduplikacja po email (primary) i telefonie (secondary) | ✓ SATISFIED | upsertLead: Tier 1 source_url, Tier 2 email upsert onConflict, Tier 3 phone check-then-insert; conditional unique indexes in DB; 5 dedup tests pass |
| DATA-02 | 02-02 | Normalizacja danych (polskie znaki, formaty telefonów, nazwy miast) | ✓ SATISFIED | normalizePolishPhone (E.164), normalizeCity (10 aliases), normalizePolishText (NFC); 20 normalization tests pass |
| DATA-03 | 02-03 | Filtrowanie business vs private sellers | ✓ SATISFIED | detectSellerType() in olx-parser.ts checks for "Firma"/"business" keywords; returns 'business'/'private'; 2 parser tests for each seller type pass |
| DATA-05 | 02-02 | Automatyczne scoring leadów 0-100 | ✓ SATISFIED | scoreLead() with 5-dimension SCORING_WEIGHTS summing to 100; output clamped; 11 scoring tests pass |
| DATA-06 | 02-04 | Każdy lead przechowuje pełne dane: imię, email, telefon, miasto, opis, kategorie, ceny, linki social | ✓ SATISFIED | ingest.ts maps all fields: name, email, phone, city, business_description, categories, price_range, social_links, score, source_platform, source_url; Lead interface has all columns nullable where appropriate |

All 9 Phase 2 requirements from REQUIREMENTS.md traceability table are addressed. No orphaned requirements found for Phase 2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| lib/scrapers/olx/olx-selectors.ts | 4 | All CSS selectors marked [ASSUMED] — not verified against live OLX HTML | ⚠️ Warning | Selectors may not match live OLX DOM structure; first real scrape may return empty results until selectors are corrected |
| lib/scrapers/olx/olx-scraper.ts | 37 | `responseType` not set on got client (plan specified `responseType: 'text'`) | ℹ️ Info | `got` defaults to auto-detection; body is cast as string — functionally correct but slightly less explicit |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in production code. All null returns are proper null-safe guard clauses, not stubs.

---

### Human Verification Required

#### 1. Live End-to-End Scrape Run

**Test:** Start the Next.js server with valid DATABASE_URL and SUPABASE credentials, then POST to /api/scrape with a real ScraperConfig:
```json
{
  "categories": ["antyki-i-kolekcje/rekodzielo"],
  "cities": ["warszawa"],
  "keywords": [],
  "maxPages": 1,
  "delayMs": 3000,
  "jitterMs": 1000,
  "concurrency": 1
}
```
**Expected:** Response `201 { "jobId": "<uuid>" }`; scrape_jobs row appears with status transitioning pending -> running -> completed; leads rows appear in Supabase with name, phone, city populated (email will be null for OLX), score > 0, source_platform = 'olx'.
**Why human:** Cannot verify Supabase DB writes, pg-boss job execution, or live OLX HTTP responses without a running server and live credentials.

#### 2. OLX CSS Selector Validation

**Test:** Inspect real OLX.pl listing pages and verify selectors in olx-selectors.ts match the live HTML structure: `[data-cy="l-card"]`, `[data-cy="seller_card"] h4`, `[data-testid="seller-badge"]`, `[data-testid="show-phone"]`, etc.
**Expected:** All selectors in OLX_SELECTORS resolve to non-empty element sets on real OLX listing index and detail pages.
**Why human:** These selectors were explicitly marked [ASSUMED] during development. OLX.pl uses React with dynamic class names — only a live browser inspection can confirm selector validity. If any selector is wrong, the corresponding field will be null/empty in the parsed RawLead.

---

### Gaps Summary

No blocking gaps found. All 14 artifacts exist, are substantive (not stubs), are wired to each other, and have data flowing through the pipeline. All 104 tests pass and TypeScript compiles clean.

The `human_needed` status reflects two items that require live environment testing:
1. The end-to-end pipeline cannot be verified without running the server against a live Supabase instance and live OLX.pl.
2. The CSS selectors are explicitly marked as assumed and require validation against live OLX HTML before the first real production scrape.

These are not implementation gaps — the code is fully implemented and correctly wired. They are operational validation steps that require a running environment.

---

_Verified: 2026-04-06T12:32:00Z_
_Verifier: Claude (gsd-verifier)_
