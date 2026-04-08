---
phase: "06-additional-scrapers-dashboard-enhancements"
plan: "02"
subsystem: "dashboard, analytics, export"
tags: [funnel-analytics, csv-export, json-export, dashboard-nav]
dependency_graph:
  requires: [lib/supabase/server.ts, lib/state-machine/lead-states.ts, lib/db/types.ts, supabase/migrations/20260408000002_google_maps_funnel_rpc.sql]
  provides: [lib/queries/analytics.ts, app/dashboard/analytics/page.tsx, app/api/export/route.ts]
  affects: [app/dashboard/layout.tsx]
tech_stack:
  added: []
  patterns: [Supabase RPC for aggregate queries, plain HTML/CSS bar chart, CSV formula injection protection via JSON.stringify]
key_files:
  created:
    - lib/queries/analytics.ts
    - app/dashboard/analytics/page.tsx
    - app/api/export/route.ts
    - tests/queries/analytics.test.ts
    - tests/api/export-route.test.ts
  modified:
    - app/dashboard/layout.tsx
decisions:
  - "Export links placed on analytics page rather than separate nav entry for cleaner UX"
  - "CSV cells wrapped in JSON.stringify for formula injection protection (T-06-05)"
  - "Platform colors: blue for olx, green for google_maps, gray fallback for unknown"
metrics:
  duration: "2 min"
  completed: "2026-04-08"
  tasks_completed: 1
  tasks_total: 2
  tests_added: 8
  tests_total_passing: 249
---

# Phase 06 Plan 02: Dashboard Analytics + Export Summary

Funnel analytics page with per-stage per-platform bar visualization, CSV/JSON export of interested/approved leads, and dashboard sidebar navigation update.

## What Was Done

### Task 1: Analytics query helper + page + export route + tests (TDD)
- Created `fetchFunnelCounts()` query helper calling `supabase.rpc('get_funnel_counts')` with error fallback to empty array
- Created server-rendered analytics page at `/dashboard/analytics` with:
  - Funnel stages in order (Nowe through Zainteresowani) with Polish labels
  - Horizontal bar segments per platform with color coding (blue=olx, green=google_maps)
  - Bar width scaled to max count across all stages
  - Platform legend with colored dots
  - Export download links (CSV and JSON) styled as buttons
- Created `GET /api/export` route supporting `?format=csv` (default) and `?format=json`:
  - Queries only interested/approved leads from Supabase (T-06-08)
  - CSV formula injection protection via `JSON.stringify()` cell wrapping (T-06-05)
  - Format parameter validation defaults unknown values to CSV (T-06-06)
  - Proper `Content-Disposition: attachment` headers for browser download
- Added "Analityka" NavLink to dashboard sidebar after "Scraping"
- Wrote 8 tests: 2 for fetchFunnelCounts, 6 for export route
- **Commits:** dab8860 (tests), efe3d42 (implementation)

### Task 2: Human verification checkpoint
- Status: AWAITING -- requires dev server startup and manual verification

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- 8 new tests passing (2 analytics query + 6 export route)
- Full test suite: 249 tests passing across 27 test files
- TypeScript: 1 pre-existing error in `app/api/track/open/[eventId]/route.ts` (out of scope, same as 06-01)
- Acceptance criteria: all file existence and grep checks pass

## Threat Model Compliance

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-06-05 | Mitigated | CSV cells wrapped in `JSON.stringify()` preventing formula injection |
| T-06-06 | Mitigated | Only `'json'` accepted as non-default format; all other values default to `'csv'` |
| T-06-07 | Accepted | Single-user internal tool; export filters to interested/approved only |
| T-06-08 | Mitigated | `.in('status', ['interested', 'approved'])` filter at Supabase query level |

## Known Stubs

None. All functionality is fully wired to Supabase RPC and queries.

## Self-Check: PASSED

- All 5 created files exist on disk
- Both commits (dab8860, efe3d42) verified in git log
- 249 tests passing across 27 test files
