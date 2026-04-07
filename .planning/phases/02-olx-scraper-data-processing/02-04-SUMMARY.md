---
phase: 02-olx-scraper-data-processing
plan: "04"
subsystem: pipeline
tags: [deduplication, ingestion, pg-boss, api-route, supabase-upsert, tdd]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [lib/pipeline/deduplicate.ts, lib/pipeline/ingest.ts, lib/queue/workers/scrape-worker.ts, app/api/scrape/route.ts]
  affects: [instrumentation.ts, leads table, scrape_jobs table]
tech_stack:
  added: []
  patterns: [three-tier-deduplication, sequential-ingestion, pg-boss-worker, supabase-upsert-on-conflict]
key_files:
  created:
    - lib/pipeline/deduplicate.ts
    - lib/pipeline/ingest.ts
    - lib/queue/workers/scrape-worker.ts
    - app/api/scrape/route.ts
    - tests/deduplicate.test.ts
    - tests/ingest.test.ts
  modified:
    - instrumentation.ts
decisions:
  - "Three-tier dedup strategy: source_url (upsert onConflict) -> email (upsert onConflict) -> phone (select-then-insert); DB unique indexes enforce atomicity"
  - "scrape_jobs.id used as pg-boss job ID so worker can update the same row without an ID mapping table"
  - "Sequential processing in ingestRawLeads (not Promise.all) to cap DB concurrency for free-tier Supabase (T-02-14)"
  - "registerScrapeWorker wrapped inside existing getBoss() try/catch in instrumentation.ts — startup failures log but don't crash the server"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 02 Plan 04: Pipeline Wiring — Deduplication, Ingest, Worker, API Summary

End-to-end ingestion pipeline wired: POST /api/scrape dispatches a pg-boss job that runs OlxScraper, pipes results through validate -> normalize -> score -> dedup -> save, and updates scrape_jobs with counts — completing Phase 2.

## What Was Built

### lib/pipeline/deduplicate.ts

`upsertLead(lead)` — three-tier deduplication strategy:
1. **source_url** (primary) — Supabase upsert with `onConflict: 'source_url', ignoreDuplicates: true`. Empty result array signals duplicate.
2. **email** — same upsert pattern with `onConflict: 'email'`. Covers leads with email but no source_url.
3. **phone** — select + check before insert. Unique DB index catches race conditions.

Returns `'created'` or `'duplicate'`. Throws on Supabase errors.

### lib/pipeline/ingest.ts

`ingestRawLeads(rawLeads, jobId?)` — full pipeline orchestrator:
- **Validate** — `RawLeadSchema.parse()` enforces scraper output contract
- **Normalize** — phone to E.164, city to canonical form, text NFC trim
- **Score** — `scoreLead(signals)` produces 0-100 integer
- **Map** — `description -> business_description`, `priceMin/priceMax -> price_range` string
- **Dedup + Save** — `upsertLead(dbLead)` with result counted
- Per-lead errors caught and counted — one bad lead never stops the batch

Returns `ScraperResult { created, duplicate, errors }`.

### lib/queue/workers/scrape-worker.ts

`registerScrapeWorker()` — registers `boss.work('scrape-olx', handler)`:
1. Updates `scrape_jobs.status = 'running'` with `started_at` timestamp
2. Calls `createScraper('olx', config).run(config)` to get raw leads
3. Passes raw leads through `ingestRawLeads(rawLeads, job.id)`
4. On success: updates `scrape_jobs` with `status='completed'`, `leads_found`, `leads_new`, `leads_duplicate`
5. On error: updates `scrape_jobs` with `status='failed'`, `error_log`, then re-throws so pg-boss marks the job failed in its own tables

### app/api/scrape/route.ts

`POST /api/scrape` — accepts ScraperConfig JSON:
- Validates `config.categories` is non-empty (400 if not)
- Inserts `scrape_jobs` record with `status='pending'` to get an ID
- Dispatches `boss.send('scrape-olx', config, { id: job.id })` — same ID for worker correlation
- Returns `201 { jobId }` on success

### instrumentation.ts (updated)

Added `registerScrapeWorker()` call after `getBoss()` startup, inside the existing try/catch block. Worker registration failure logs but does not crash the Next.js server.

## Test Results

- **deduplicate.test.ts:** 5 tests — source_url created, source_url duplicate, email upsert, phone check (new), phone match (duplicate)
- **ingest.test.ts:** 7 tests — phone normalization, city normalization, score inclusion, ScraperResult counts, invalid lead error, field mapping (description, priceMin/priceMax)
- **Full suite:** 104/104 tests pass (11 test files)
- **TypeScript:** `npx tsc --noEmit` — zero errors

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Deduplication module + ingestion orchestrator + tests | 63747cc |
| 2 | Scrape worker + API route + instrumentation wiring | 068d7bf |

## Deviations from Plan

None — plan executed exactly as written.

The plan's instrumentation.ts snippet placed `registerScrapeWorker` inside the existing try/catch block alongside `getBoss()`. This was the correct approach — any startup failure is already handled by the existing catch.

## Known Stubs

None. All pipeline stages are fully wired with real logic. No placeholder data flows.

`lawful_basis: 'legitimate_interest'` is hardcoded per the DB schema constraint — not a stub, it is the only valid value at this stage.

## Threat Surface

All threats from the plan's STRIDE register are mitigated:

| Threat | Mitigation Implemented |
|--------|------------------------|
| T-02-11 (Tampering — request body) | `config.categories?.length` check returns 400; ScraperConfig type constrains fields |
| T-02-12 (Repudiation — worker audit) | scrape_jobs records status, started_at, completed_at, error_log for every job |
| T-02-13 (Tampering — SQL injection) | Supabase parameterized queries; upsert with ON CONFLICT is atomic |
| T-02-14 (DoS — unbounded concurrency) | Sequential for-loop in ingestRawLeads; per-lead error catch prevents batch crash |

T-02-10 (auth on POST /api/scrape) accepted per plan — single-user tool, Phase 3 adds dashboard auth.

## Self-Check: PASSED

- [x] lib/pipeline/deduplicate.ts exists
- [x] lib/pipeline/ingest.ts exists
- [x] lib/queue/workers/scrape-worker.ts exists
- [x] app/api/scrape/route.ts exists
- [x] tests/deduplicate.test.ts exists
- [x] tests/ingest.test.ts exists
- [x] instrumentation.ts contains registerScrapeWorker
- [x] Commit 63747cc exists (Task 1)
- [x] Commit 068d7bf exists (Task 2)
- [x] 104/104 tests pass
- [x] TypeScript clean
