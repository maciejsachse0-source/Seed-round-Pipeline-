---
phase: 06-additional-scrapers-dashboard-enhancements
verified: 2026-04-08T11:32:30Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
overrides:
  - must_have: "Dashboard sidebar includes Analityka and Eksport nav links"
    reason: "Plan 02 task action explicitly states: 'Do NOT add a separate Eksport nav link — the export buttons are on the analytics page itself (cleaner UX).' Export is accessible via /api/export links on the analytics page. Roadmap SC3 ('User can export all interested/approved sellers to a CSV or JSON file from the dashboard') is satisfied. The must_have wording in the plan frontmatter contradicts the plan's own action steps — the deviation is intentional."
    accepted_by: "gsd-verifier"
    accepted_at: "2026-04-08T11:32:30Z"
human_verification:
  - test: "Navigate to /dashboard/analytics in the running dev server"
    expected: "Page shows 'Analityka lejka' heading, funnel stages listed in order (Nowe through Zainteresowani), horizontal bar segments per platform with color coding, platform legend, and two export buttons (Eksportuj CSV, Eksportuj JSON)"
    why_human: "Server-rendered React page — visual correctness and bar rendering cannot be verified programmatically"
  - test: "Click 'Eksportuj CSV' button on the analytics page"
    expected: "Browser downloads a file named leads-export.csv; first row is 'id,name,email,phone,city,source_platform,status,score,created_at'"
    why_human: "Browser download behavior triggered by Content-Disposition header requires manual browser interaction"
  - test: "Click 'Eksportuj JSON' button on the analytics page"
    expected: "Browser downloads a file named leads-export.json; file is a valid JSON array"
    why_human: "Browser download behavior requires manual verification"
  - test: "Verify 'Analityka' link in dashboard sidebar navigates to /dashboard/analytics"
    expected: "Clicking 'Analityka' in sidebar opens the analytics page without errors, active state highlights correctly"
    why_human: "Navigation behavior and active state of NavLink component requires browser interaction"
  - test: "Verify Google Maps scrape job dispatches correctly via POST /api/scrape"
    expected: "POST body with platform='google_maps' and keywords/cities creates a scrape_jobs record and dispatches a 'scrape-google-maps' pg-boss job"
    why_human: "Requires live Supabase connection and pg-boss; cannot verify end-to-end without deployed infrastructure"
---

# Phase 6: Additional Scrapers + Dashboard Enhancements — Verification Report

**Phase Goal:** The pipeline covers a second lead source (Google Maps) and the dashboard provides funnel analytics and data export for operational decision-making.
**Verified:** 2026-04-08T11:32:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RawLeadSchema accepts sourcePlatform 'google_maps' without validation error | VERIFIED | `sourcePlatform: z.enum(['olx', 'google_maps'])` in lib/scrapers/types.ts:39; Test 1 in google-maps-scraper.test.ts passes |
| 2 | GoogleMapsScraper implements ScraperAdapter and is registered in SCRAPERS registry | VERIFIED | `export class GoogleMapsScraper implements ScraperAdapter` in google-maps-scraper.ts:87; `google_maps: GoogleMapsScraper` in lib/scrapers/index.ts:12 |
| 3 | createScraper('google_maps', config) returns a GoogleMapsScraper instance | VERIFIED | Tests 7 and 8 pass; createScraper() uses SCRAPERS record which includes google_maps |
| 4 | scrape-google-maps pg-boss worker is registered at server startup | VERIFIED | instrumentation.ts calls registerScrapeWorker() which calls getAvailableScrapers() and registers scrape-${platform} dynamically; scrape-worker.ts:87-92 |
| 5 | POST /api/scrape with platform 'google_maps' creates a scrape job and dispatches to pg-boss | VERIFIED | app/api/scrape/route.ts:32-76; platform validated against getAvailableScrapers(), boss.send(`scrape-${platform}`, ...) at line 76 |
| 6 | get_funnel_counts() SQL function exists in migration and returns status + source_platform + count | VERIFIED | supabase/migrations/20260408000002_google_maps_funnel_rpc.sql:7-16; RETURNS TABLE(status text, source_platform text, count bigint) SECURITY DEFINER |
| 7 | User can navigate to /dashboard/analytics and see funnel counts per status per source_platform | VERIFIED (code) | app/dashboard/analytics/page.tsx calls fetchFunnelCounts(), groups by status+platform, renders FUNNEL_STAGES; human verification needed for visual correctness |
| 8 | Funnel analytics page shows conversion counts broken down by source platform (OLX vs Google Maps) | VERIFIED (code) | Page maps platform to bg-blue-500/bg-green-500 bars; allPlatforms collected from live data; bar width calculated from maxCount |
| 9 | User can click an export link and download a CSV file of interested/approved leads | VERIFIED (code) | GET /api/export?format=csv returns Content-Type: text/csv, Content-Disposition: attachment; queries .in('status', ['interested','approved']); 6 export-route tests pass |
| 10 | User can click an export link and download a JSON file of interested/approved leads | VERIFIED (code) | GET /api/export?format=json returns Content-Type: application/json, Content-Disposition: attachment; same status filter |
| 11 | Dashboard sidebar includes Analityka and Eksport nav links | PASSED (override) | Analityka nav link present at layout.tsx:22. No separate Eksport nav link — export buttons are on analytics page by explicit plan design. Override applied: roadmap SC3 satisfied via page-level export links. |

**Score:** 5/6 truths fully verified without override (6/6 with override applied). Human verification required for browser/deployment behavior.

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC1 | Running a Google Maps scrape job for a given location and category produces leads in Supabase using the same adapter interface as OLX | VERIFIED (code) | GoogleMapsScraper implements ScraperAdapter; uses same ingestRawLeads pipeline; 8 tests pass |
| SC2 | User can view a funnel analytics view showing conversion counts per pipeline stage broken down by source platform | VERIFIED (code) / human needed | Page exists and is wired to get_funnel_counts RPC; visual needs human |
| SC3 | User can export all interested/approved sellers to a CSV or JSON file from the dashboard | VERIFIED (code) / human needed | Export route exists with correct status filter and Content-Disposition; browser download needs human |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/scrapers/google-maps/google-maps-scraper.ts` | Google Maps Places API scraper implementing ScraperAdapter | VERIFIED | 137 lines; exports GoogleMapsScraper; implements ScraperAdapter; uses got; GOOGLE_MAPS_API_KEY server-only |
| `supabase/migrations/20260408000002_google_maps_funnel_rpc.sql` | get_funnel_counts() RPC function | VERIFIED | CREATE OR REPLACE FUNCTION get_funnel_counts() RETURNS TABLE(...) LANGUAGE sql SECURITY DEFINER |
| `tests/scrapers/google-maps-scraper.test.ts` | Unit tests for Google Maps scraper | VERIFIED | 8 tests across 3 describe blocks; all pass |
| `lib/queries/analytics.ts` | fetchFunnelCounts() query helper | VERIFIED | Exports fetchFunnelCounts and FunnelRow; calls supabase.rpc('get_funnel_counts') |
| `app/dashboard/analytics/page.tsx` | Server-rendered funnel analytics page | VERIFIED | Async server component; calls fetchFunnelCounts(); renders bars; export links present |
| `app/api/export/route.ts` | GET endpoint for CSV/JSON export | VERIFIED | Format switch; status filter; Content-Disposition attachment; JSON.stringify CSV protection |
| `tests/queries/analytics.test.ts` | Unit tests for fetchFunnelCounts | VERIFIED | 2 tests pass (success + error fallback) |
| `tests/api/export-route.test.ts` | Unit tests for export route | VERIFIED | 6 tests pass (CSV, JSON, default, header row, array validity, status filter) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| lib/scrapers/index.ts | lib/scrapers/google-maps/google-maps-scraper.ts | SCRAPERS registry entry google_maps | WIRED | `google_maps: GoogleMapsScraper` at index.ts:12 |
| lib/queue/workers/scrape-worker.ts | lib/scrapers/index.ts | createScraper(platform, config) | WIRED | Imports createScraper and getAvailableScrapers; uses both at runtime |
| app/api/scrape/route.ts | lib/queue/workers/scrape-worker.ts | pg-boss job dispatch with platform from request body | WIRED | boss.send(`scrape-${platform}`, config, {id: job.id}) at route.ts:76 |
| instrumentation.ts | lib/queue/workers/scrape-worker.ts | registerScrapeWorker() at startup | WIRED | instrumentation.ts:11-12 imports and calls registerScrapeWorker() |
| app/dashboard/analytics/page.tsx | lib/queries/analytics.ts | fetchFunnelCounts() call | WIRED | import at page.tsx:4; called at page.tsx:34 |
| lib/queries/analytics.ts | supabase.rpc('get_funnel_counts') | Supabase RPC call | WIRED | `supabase.rpc('get_funnel_counts')` at analytics.ts:13 |
| app/dashboard/layout.tsx | app/dashboard/analytics/page.tsx | NavLink href='/dashboard/analytics' | WIRED | `<NavLink href="/dashboard/analytics">Analityka</NavLink>` at layout.tsx:22 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| app/dashboard/analytics/page.tsx | rows (FunnelRow[]) | fetchFunnelCounts() → supabase.rpc('get_funnel_counts') → DB query GROUP BY status, source_platform | Yes — SQL aggregate query against leads table | FLOWING |
| app/api/export/route.ts | leads | supabase.from('leads').select('*').in('status', [...]).order(...) | Yes — direct DB query with status filter | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GoogleMapsScraper tests (8 tests) | npx vitest run tests/scrapers/google-maps-scraper.test.ts | 8 passed | PASS |
| Analytics query tests (2 tests) | npx vitest run tests/queries/analytics.test.ts | 2 passed | PASS |
| Export route tests (6 tests) | npx vitest run tests/api/export-route.test.ts | 6 passed | PASS |
| Full test suite | npx vitest run (all files) | 249 tests passing per SUMMARY | PASS (per SUMMARY — not re-run in full) |
| TypeScript compilation | npx tsc --noEmit | 1 pre-existing error in app/api/track/open/[eventId]/route.ts (out of scope) | PASS (phase 06 files clean) |
| NEXT_PUBLIC prefix absent in scraper | grep NEXT_PUBLIC google-maps-scraper.ts | 1 match — comment only, not in code | PASS (comment mentions absence of prefix; actual env access uses process.env.GOOGLE_MAPS_API_KEY) |
| No hardcoded scrape-olx in worker | grep scrape-olx scrape-worker.ts | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRP-02 | 06-01 | System scrapuje dane firm handmade z Google Maps (Places API lub Playwright) | SATISFIED | GoogleMapsScraper uses Places API (New) Text Search; full adapter implementation wired into pipeline |
| DASH-04 | 06-02 | User widzi analitykę lejka (konwersje per etap, per źródło) | SATISFIED (code) | /dashboard/analytics page renders per-stage per-platform counts; human verification for visual |
| DASH-05 | 06-02 | User może eksportować zainteresowanych sprzedawców do CSV/JSON | SATISFIED (code) | GET /api/export?format=csv/json returns interested/approved leads with proper download headers |

No orphaned requirements detected — REQUIREMENTS.md maps exactly SCRP-02, DASH-04, DASH-05 to Phase 6, all accounted for in plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/dashboard/layout.tsx | 4 | `// TODO: Add authentication when dashboard is deployed publicly` | Info | Pre-existing from Phase 3; not introduced by Phase 6; no impact on phase goal |

No stubs, placeholder returns, or hollow data flows detected in Phase 6 files.

### Human Verification Required

#### 1. Analytics Page Visual Rendering

**Test:** Start dev server (`npm run dev`), navigate to http://localhost:3000/dashboard/analytics
**Expected:** Page shows "Analityka lejka" heading; funnel stages Nowe/Ocenione/Zatwierdzone/Skontaktowane/Follow-up/Odpowiedzi/Zainteresowani listed in order; horizontal bar segments with blue=OLX, green=Google Maps color coding; platform legend dots; two styled export buttons
**Why human:** Server-rendered React components with Tailwind CSS bars — visual correctness, layout, and zero-data behavior cannot be verified programmatically

#### 2. CSV Download

**Test:** Click "Eksportuj CSV" button on the analytics page
**Expected:** Browser triggers download of `leads-export.csv`; first line is `id,name,email,phone,city,source_platform,status,score,created_at`; subsequent rows are interested/approved leads
**Why human:** `Content-Disposition: attachment` triggers browser download — cannot simulate without a real browser session

#### 3. JSON Download

**Test:** Click "Eksportuj JSON" button on the analytics page
**Expected:** Browser triggers download of `leads-export.json`; content is valid JSON array of lead objects
**Why human:** Same as CSV — browser download behavior requires manual testing

#### 4. Sidebar Navigation Active State

**Test:** Click "Analityka" in dashboard sidebar
**Expected:** Navigates to /dashboard/analytics; NavLink shows active highlight styling for the analytics entry
**Why human:** NavLink active state depends on usePathname hook behavior in the browser

#### 5. Google Maps Scrape End-to-End

**Test:** POST to /api/scrape with body `{"platform":"google_maps","config":{"keywords":["handmade"],"cities":["Warszawa"],"categories":[],"maxPages":1,"delayMs":2000,"jitterMs":500,"concurrency":1}}`
**Expected:** Returns 201 with jobId; scrape_jobs record created in Supabase with platform='google_maps'; pg-boss dispatches scrape-google-maps job; after job runs, new leads appear in leads table with source_platform='google_maps'
**Why human:** Requires live Supabase + GOOGLE_MAPS_API_KEY configured; cannot test without deployed infrastructure

### Gaps Summary

No blocking gaps found. All code artifacts exist, are substantive, and are correctly wired. Data flows from the database through queries to rendering. The 16 phase-specific tests all pass. The one must_have discrepancy (no separate "Eksport" nav link) is an intentional plan deviation where the plan action text overrides the plan frontmatter — the roadmap success criterion is met via export buttons on the analytics page.

Phase goal is **code-complete**. Human verification is required to confirm browser behavior (downloads, visual rendering, live navigation) and end-to-end pipeline behavior with live infrastructure.

---

_Verified: 2026-04-08T11:32:30Z_
_Verifier: Claude (gsd-verifier)_
