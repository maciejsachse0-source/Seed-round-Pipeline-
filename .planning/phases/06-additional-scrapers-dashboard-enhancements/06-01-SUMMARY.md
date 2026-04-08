---
phase: "06-additional-scrapers-dashboard-enhancements"
plan: "01"
subsystem: "scrapers, pipeline, api"
tags: [google-maps, places-api, scraper-adapter, multi-platform, funnel-rpc]
dependency_graph:
  requires: [lib/scrapers/types.ts, lib/scrapers/index.ts, lib/scrapers/olx/olx-scraper.ts, lib/pipeline/ingest.ts, lib/queue/boss.ts]
  provides: [lib/scrapers/google-maps/google-maps-scraper.ts, supabase/migrations/20260408000002_google_maps_funnel_rpc.sql]
  affects: [lib/queue/workers/scrape-worker.ts, app/api/scrape/route.ts]
tech_stack:
  added: []
  patterns: [Places API (New) Text Search via got, dynamic pg-boss worker registration, platform allowlist validation]
key_files:
  created:
    - lib/scrapers/google-maps/google-maps-scraper.ts
    - supabase/migrations/20260408000002_google_maps_funnel_rpc.sql
    - tests/scrapers/google-maps-scraper.test.ts
  modified:
    - lib/scrapers/types.ts
    - lib/scrapers/index.ts
    - lib/queue/workers/scrape-worker.ts
    - app/api/scrape/route.ts
decisions:
  - "Google Maps scraper uses config.keywords as textQuery basis, config.cities as location suffix"
  - "City extraction uses heuristic: second-to-last comma segment, strip postal code prefix"
  - "categories validation relaxed for google_maps (only required for olx)"
metrics:
  duration: "4 min"
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 8
  tests_total_passing: 241
---

# Phase 06 Plan 01: Google Maps Scraper + Multi-Platform Pipeline Summary

Google Maps Places API (New) Text Search scraper implementing ScraperAdapter, with dynamic multi-platform pg-boss worker registration and platform-aware API route.

## What Was Done

### Task 1: Extend sourcePlatform schema + Google Maps scraper + tests (TDD)
- Extended `RawLeadSchema.sourcePlatform` from `z.literal('olx')` to `z.enum(['olx', 'google_maps'])`
- Extended `RawLead` interface `sourcePlatform` to `'olx' | 'google_maps'`
- Created `GoogleMapsScraper` class implementing `ScraperAdapter` using Places API (New) Text Search endpoint via `got`
- Registered `google_maps: GoogleMapsScraper` in SCRAPERS registry
- Created `get_funnel_counts()` SQL RPC migration for funnel analytics
- Wrote 8 unit tests covering schema extension, scraper behavior, pagination, empty results, and registry
- **Commit:** afd30be

### Task 2: Wire scrape worker + API route for multi-platform
- Refactored `registerScrapeWorker()` to dynamically register pg-boss workers for all platforms via `getAvailableScrapers()`
- Eliminated all hardcoded `'scrape-olx'` references in worker
- Updated `POST /api/scrape` to accept `platform` field from request body (defaults to `'olx'` for backward compat)
- Added platform allowlist validation via `getAvailableScrapers()` (T-06-02)
- Relaxed categories validation for google_maps (categories not meaningful for Places API)
- **Commit:** 60a2edf

## Deviations from Plan

### Adjustments

**1. [Rule 3 - Blocking] Skipped `supabase db push`**
- **Found during:** Task 2
- **Issue:** `supabase db push` requires active Supabase connection which may not be available in worktree/CI context
- **Resolution:** Migration file created and committed; push deferred to deployment or manual step
- **Impact:** None on code quality; migration is ready to deploy

**2. [Rule 2 - Missing functionality] Categories validation relaxed for google_maps**
- **Found during:** Task 2
- **Issue:** Original route required non-empty `categories` for all platforms, but Google Maps scraper uses `keywords` not `categories`
- **Fix:** Made categories validation conditional on `platform === 'olx'`
- **Impact:** Google Maps scrape jobs can be dispatched without OLX-specific categories

## Verification Results

- All 8 new Google Maps scraper tests passing
- Full test suite: 241 tests passing across 25 test files
- TypeScript: 1 pre-existing error in `app/api/track/open/[eventId]/route.ts` (out of scope)
- Acceptance criteria: all grep checks pass (z.enum, registry, dynamic queue names, no NEXT_PUBLIC, SECURITY DEFINER)

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-06-01 | Mitigated | `GOOGLE_MAPS_API_KEY` used server-only, no `NEXT_PUBLIC_` prefix |
| T-06-02 | Mitigated | Platform validated against `getAvailableScrapers()` allowlist |
| T-06-03 | Mitigated | Places API results pass through existing `RawLeadSchema.parse()` via `ingestRawLeads()` |
| T-06-04 | Mitigated | Pagination loop terminates on missing `nextPageToken` OR `maxPages` reached |

## Known Stubs

None. All functionality is fully wired.

## Self-Check: PASSED
