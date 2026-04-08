---
phase: 05-follow-up-sequences
verified: 2026-04-08T09:57:00Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to http://localhost:3000/dashboard and confirm sidebar shows four links: Leady, Szablony, Sekwencje, Scraping"
    expected: "All four nav links visible and correct order"
    why_human: "Server Component rendering cannot be verified by static grep — requires browser render"
  - test: "Click Sekwencje — verify config form loads with defaults (2 follow-ups, 5 days), change values and Save, refresh and confirm persistence"
    expected: "Form loads, saves, persists after refresh; success message shown on save"
    why_human: "Client-side fetch/state interaction requires a running browser"
  - test: "Enter invalid values (interval_days=0 or max_follow_ups=99) and attempt to save"
    expected: "API returns 400 and form shows validation error"
    why_human: "End-to-end Zod validation path requires live API call"
  - test: "Click Scraping — verify scrape trigger form loads (SCRP-06)"
    expected: "TriggerScrapeForm renders with platform/category inputs"
    why_human: "Component render requires running dev server"
  - test: "Start dev server and check terminal for '[follow-up-worker] registered follow-up-send worker'"
    expected: "Worker registration log line appears at startup"
    why_human: "Requires starting the Next.js server and observing stdout"
  - test: "Run 'npx supabase login' then 'npx supabase link --project-ref uwuicdilargmuvhfdwue' then 'npx supabase db push' to deploy sequence_config migration"
    expected: "Migration runs cleanly, sequence_config table exists in live DB"
    why_human: "Requires Supabase auth credentials — failed during automated execution"
---

# Phase 5: Follow-up Sequences Verification Report

**Phase Goal:** The system automatically sends configured follow-up emails to leads that have not replied, stopping immediately on any reply.
**Verified:** 2026-04-08T09:57:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A lead that has not replied receives follow-up emails according to the configured sequence (default: 2 follow-ups, minimum 5-day gaps) | VERIFIED | `follow-up-worker.ts` checks `ACTIVE_SEQUENCE_STATUSES = [CONTACTED, FOLLOWED_UP]` before sending; `scheduleFollowUp` uses `startAfter = intervalDays * 86400`; `email-worker.ts` calls `scheduleFollowUp(leadId, 1, config)` after successful cold email send |
| 2 | A lead that replies at any point receives no further follow-up emails | VERIFIED | Worker checks `lead.status` on every execution; `replied` and `opted_out` are not in `ACTIVE_SEQUENCE_STATUSES`; reply detection from Phase 4 sets status to `replied`; 11 tests confirm all stop conditions |
| 3 | User can configure the number of follow-ups and the interval between emails from the dashboard | VERIFIED (automated) / PENDING (human) | `app/api/sequence-config/route.ts` GET/PATCH endpoints exist and are wired to `getSequenceConfig`/`updateSequenceConfig`; `app/dashboard/sequence/page.tsx` fetches on mount and PATCHes on save; Zod validation enforces 0-10 / 1-30 bounds — visual confirmation pending |
| 4 | User can manually trigger a scrape job from the dashboard (SCRP-06) | VERIFIED (automated) / PENDING (human) | `app/dashboard/scrape/page.tsx` exists, renders `TriggerScrapeForm`; "Scraping" NavLink present in `app/dashboard/layout.tsx` — visual confirmation pending |
| 5 | scheduleFollowUp enqueues a pg-boss job with startAfter = intervalDays * 86400 seconds | VERIFIED | `follow-up.ts` line 50-58: `delaySeconds = config.intervalDays * 24 * 60 * 60`, passed as `startAfter`; 4 enqueue tests pass |
| 6 | scheduleFollowUp is a no-op when sequenceStep exceeds maxFollowUps or is < 1 | VERIFIED | `follow-up.ts` line 47: `if (sequenceStep < 1 || sequenceStep > config.maxFollowUps) return`; 4 no-op tests pass |
| 7 | Follow-up worker skips send when lead.status is replied, opted_out, rejected, or any non-active status | VERIFIED | Worker checks `ACTIVE_SEQUENCE_STATUSES.includes(lead.status)` at line 58; tests cover replied, opted_out, approved, lead-not-found |
| 8 | Follow-up worker sends via sendColdEmail with targetStatus=FOLLOWED_UP and correct sequence_number | VERIFIED | `follow-up-worker.ts` line 82-85: `sendColdEmail(lead, template, { targetStatus: LeadStatus.FOLLOWED_UP, sequenceNumber: sequenceStep })`; test asserts exact call signature |
| 9 | Follow-up worker schedules the next step after a successful send | VERIFIED | Worker line 92-93: `await scheduleFollowUp(leadId, sequenceStep + 1, config)`; test confirms `scheduleFollowUp` called with step+1 |
| 10 | sendColdEmail accepts optional targetStatus param (defaults to CONTACTED) and optional sequenceNumber (defaults to 0) | VERIFIED | `send.ts` line 46-52: signature `options?: { targetStatus?: LeadStatus; sequenceNumber?: number }` with explicit `?? LeadStatus.CONTACTED` and `?? 0` defaults; backward-compatible |
| 11 | getSequenceConfig falls back to defaults when sequence_config table does not exist or is empty | VERIFIED | `sequence-config.ts`: catches errors and returns `DEFAULT_ROW`; `follow-up.ts` `getSequenceConfigForScheduler` also catches and returns `DEFAULT_SEQUENCE_CONFIG`; 3 fallback tests pass |
| 12 | supabase db push creates the sequence_config table in the live database | PENDING (human) | Migration SQL file exists and is syntactically valid; `supabase db push` failed during automated execution (auth not configured) — requires user to run manually |

**Score:** 11/12 truths verified (1 pending human action)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260408000001_sequence_config.sql` | sequence_config singleton table with default row | VERIFIED | `CREATE TABLE sequence_config`, `CONSTRAINT singleton CHECK (id = 1)`, `INSERT ... ON CONFLICT DO NOTHING` — all present |
| `lib/db/types.ts` | SequenceConfig TypeScript interface | VERIFIED | `SequenceConfig` interface at line 86-91 with `id`, `max_follow_ups`, `interval_days`, `updated_at` |
| `lib/queries/sequence-config.ts` | getSequenceConfig and updateSequenceConfig DB helpers | VERIFIED | Both functions exported, fallback logic in `getSequenceConfig`, upsert logic in `updateSequenceConfig` |
| `lib/email/follow-up.ts` | scheduleFollowUp function and DEFAULT_SEQUENCE_CONFIG | VERIFIED | All three exports present: `scheduleFollowUp`, `getSequenceConfigForScheduler`, `DEFAULT_SEQUENCE_CONFIG` |
| `lib/email/send.ts` | sendColdEmail with targetStatus and sequenceNumber params | VERIFIED | Signature updated with optional third param; defaults preserve Phase 4 behavior |
| `lib/queue/workers/follow-up-worker.ts` | pg-boss worker for follow-up-send queue | VERIFIED | `registerFollowUpWorker` exported; worker registered on `follow-up-send`; all stop conditions implemented |
| `app/api/sequence-config/route.ts` | GET and PATCH endpoints for sequence config | VERIFIED | Both handlers present; Zod `UpdateSchema` validates bounds; wired to `getSequenceConfig`/`updateSequenceConfig` |
| `app/dashboard/sequence/page.tsx` | Sequence configuration UI page | VERIFIED | `'use client'`; `useEffect` fetches on mount; `handleSave` PATCHes API; form with two number inputs; success/error feedback; warning section present |
| `app/dashboard/layout.tsx` | Dashboard nav with Sekwencje link | VERIFIED | `<NavLink href="/dashboard/sequence">Sekwencje</NavLink>` present at correct nav position (after Szablony, before Scraping) |
| `tests/email/follow-up.test.ts` | Unit tests for scheduleFollowUp | VERIFIED | 12 tests: enqueue behavior (4), no-op conditions (4), getSequenceConfig fallback (3), DEFAULT export (1) — all pass |
| `tests/queue/follow-up-worker.test.ts` | Unit tests for follow-up worker stop conditions | VERIFIED | 11 tests: registration (2), stop conditions (5), successful send (3), failed send (1) — all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/queue/workers/follow-up-worker.ts` | `lib/email/send.ts` | `sendColdEmail(lead, template, { targetStatus: LeadStatus.FOLLOWED_UP, sequenceNumber })` | WIRED | Line 82-85; pattern `sendColdEmail.*targetStatus` present |
| `lib/queue/workers/follow-up-worker.ts` | `lib/email/follow-up.ts` | `scheduleFollowUp(leadId, sequenceStep + 1, config)` | WIRED | Line 93; `scheduleFollowUp` imported at line 10 |
| `lib/email/follow-up.ts` | `lib/queue/boss.ts` | `boss.send('follow-up-send', data, { startAfter })` | WIRED | Lines 52-58; pattern `boss.send.*follow-up-send` present |
| `app/dashboard/sequence/page.tsx` | `/api/sequence-config` | `fetch GET on mount, PATCH on save` | WIRED | Line 23: `fetch('/api/sequence-config')`; line 43: `fetch('/api/sequence-config', { method: 'PATCH', ... })` |
| `app/api/sequence-config/route.ts` | `lib/queries/sequence-config.ts` | `getSequenceConfig and updateSequenceConfig calls` | WIRED | Line 8 import; GET calls `getSequenceConfig()`, PATCH calls `updateSequenceConfig(...)` |
| `lib/queue/workers/email-worker.ts` | `lib/email/follow-up.ts` | Dynamic import after successful cold email | WIRED | Lines 88-90: `const { getSequenceConfigForScheduler, scheduleFollowUp } = await import('@/lib/email/follow-up')` |
| `instrumentation.ts` | `lib/queue/workers/follow-up-worker.ts` | `registerFollowUpWorker()` at startup | WIRED | Lines 17-18: imported and awaited in `register()` function |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `app/dashboard/sequence/page.tsx` | `maxFollowUps`, `intervalDays` | `fetch('/api/sequence-config')` → `getSequenceConfig()` → Supabase `sequence_config` table (with fallback) | Yes — live DB query with fallback to defaults | FLOWING |
| `lib/queue/workers/follow-up-worker.ts` | `lead`, `template` | Supabase `leads` + `email_templates` queries; status check gates send | Yes — real DB queries; stop conditions gated on live lead status | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| follow-up.test.ts: all 12 tests pass | `npx vitest run tests/email/follow-up.test.ts` | 12 passed (0 failed) | PASS |
| follow-up-worker.test.ts: all 11 tests pass | `npx vitest run tests/queue/follow-up-worker.test.ts` | 11 passed (0 failed) | PASS |
| Full test suite: no regressions | `npx vitest run` | 233 passed (24 test files) | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 1 pre-existing error in `app/api/track/open/[eventId]/route.ts` (Property 'catch' does not exist on type 'PromiseLike<void>') — not caused by Phase 5 | PASS (pre-existing, out of scope) |
| Dashboard scrape page exists | File check | `app/dashboard/scrape/page.tsx` exists, renders `TriggerScrapeForm` | PASS |
| Scraping nav link in layout | File check | `<NavLink href="/dashboard/scrape">Scraping</NavLink>` present in layout | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAIL-03 | 05-01, 05-02 | System automatically sends follow-ups with configurable intervals (default: 2 follow-ups, 5+ days) | SATISFIED | Follow-up worker, scheduleFollowUp, email-worker chain, sequence_config DB, dashboard UI — all implemented and tested |
| SCRP-06 | 05-02 | Scraper jobs can be triggered manually from the dashboard | SATISFIED | `app/dashboard/scrape/page.tsx` exists with `TriggerScrapeForm`; "Scraping" NavLink in layout.tsx; page was originally built in Phase 3 and verified present in Phase 5 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/track/open/[eventId]/route.ts` | 37 | Pre-existing TS error: `Property 'catch' does not exist on type 'PromiseLike<void>'` | Info | Pre-existing error documented in Phase 4 SUMMARY; not caused by Phase 5; Phase 5 changes compile cleanly |

No stub patterns, empty returns, or placeholder implementations found in any Phase 5 artifacts. All data flows are wired to live endpoints.

### Human Verification Required

#### 1. Dashboard Visual Rendering

**Test:** Start the dev server (`npm run dev`), navigate to `http://localhost:3000/dashboard`, and confirm the sidebar shows four nav links in order: Leady, Szablony, Sekwencje, Scraping.
**Expected:** All four links visible; Sekwencje link correctly positioned between Szablony and Scraping.
**Why human:** Server Component rendering requires a browser — cannot verify from static file analysis.

#### 2. Sequence Config Form — Load and Save

**Test:** Click "Sekwencje" in the sidebar. Verify the form loads with default values (2 follow-ups, 5 days). Change to 3 follow-ups and 7 days, click Save, verify success message. Refresh and confirm the new values persist.
**Expected:** Form loads from API, save PATCHes API, values persist after refresh.
**Why human:** Client-side fetch/state interaction and persistence require a running browser with live API.

#### 3. Validation Rejection

**Test:** Enter `interval_days = 0` or `max_follow_ups = 99` and click Save.
**Expected:** API returns 400, form displays a validation error message.
**Why human:** Requires a live API call to trigger Zod `safeParse` rejection path.

#### 4. Scrape Trigger Page (SCRP-06)

**Test:** Click "Scraping" in the sidebar. Verify the `TriggerScrapeForm` renders with platform and category inputs.
**Expected:** Scrape trigger form loads and is interactive.
**Why human:** Component rendering requires a running dev server.

#### 5. Follow-up Worker Startup Log

**Test:** Start the dev server and check terminal output.
**Expected:** `[follow-up-worker] registered follow-up-send worker` appears in startup logs.
**Why human:** Requires starting the Next.js server and observing stdout.

#### 6. Supabase DB Push (sequence_config migration)

**Test:** Run the following commands:
```
npx supabase login
npx supabase link --project-ref uwuicdilargmuvhfdwue
npx supabase db push
```
**Expected:** Migration `20260408000001_sequence_config.sql` applies cleanly; `sequence_config` table exists in the live database with a default row (`max_follow_ups=2, interval_days=5`).
**Why human:** Requires Supabase auth credentials. The `db push` command failed during automated execution with "Access token not provided." The application falls back to hardcoded defaults until the migration is applied.

### Gaps Summary

No automated gaps. All backend logic (scheduling, worker, sendColdEmail parameterization, DB helpers) is fully implemented, wired, and test-verified. The single pending item is the `supabase db push` requiring user authentication — the app functions with fallback defaults until that step is completed.

Six items require human verification (dashboard UI visual confirmation + DB push) before the phase can be marked fully complete.

---

_Verified: 2026-04-08T09:57:00Z_
_Verifier: Claude (gsd-verifier)_
