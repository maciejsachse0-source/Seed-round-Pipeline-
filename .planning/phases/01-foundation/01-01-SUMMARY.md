---
phase: 01-foundation
plan: 01
subsystem: database
tags: [supabase, postgresql, gdpr, vitest, typescript, suppression-list]

# Dependency graph
requires: []
provides:
  - "supabase/migrations/20260406000001_initial_schema.sql — 5-table initial schema with GDPR fields"
  - "lib/db/types.ts — hand-written TypeScript types for all 5 tables"
  - "lib/db/suppression.ts — isEmailSuppressed() and addToSuppressionList() helpers"
  - "lib/supabase/server.ts — stub for server-side Supabase client (Plan 01-03 implements)"
  - "tests/suppression.test.ts — 4 unit tests for suppression list (all passing)"
  - "vitest.config.ts — test framework configured with @/ path alias"
affects:
  - 01-02
  - 01-03
  - 01-04
  - 02-scraper
  - 04-email
  - 05-followup

# Tech tracking
tech-stack:
  added:
    - "vitest 4.1.2 — test framework"
  patterns:
    - "Suppression list check by email (not lead UUID) — GDPR defense-in-depth"
    - "Email normalization to lowercase on every suppression read/write"
    - "vi.mock for unit testing Supabase-dependent code without real DB"
    - "Supabase migrations in supabase/migrations/ with timestamped filenames"

key-files:
  created:
    - "supabase/migrations/20260406000001_initial_schema.sql"
    - "lib/db/types.ts"
    - "lib/db/suppression.ts"
    - "lib/supabase/server.ts"
    - "tests/suppression.test.ts"
    - "vitest.config.ts"
  modified:
    - "package.json"

key-decisions:
  - "lib/supabase/server.ts stub created so vi.mock can intercept imports in tests — Plan 01-03 overwrites with real @supabase/ssr implementation"
  - "suppression_list checks by email address not lead UUID — covers re-scrape scenario where same email gets new UUID"
  - "lawful_basis DEFAULT 'legitimate_interest' in migration so no INSERT ever needs to supply it"
  - "email_events.template_id has no FK in Phase 1 — FK added in Phase 4 when email_templates table is guaranteed to exist"

patterns-established:
  - "Pattern: Always call isEmailSuppressed() before any email send — independent of lead.status"
  - "Pattern: Email normalization — always toLowerCase() before any suppression_list query or insert"
  - "Pattern: Supabase upsert for suppression entries — safe to call multiple times for same email"

requirements-completed:
  - INFR-01
  - INFR-04
  - MAIL-07
  - MAIL-08

# Metrics
duration: 8min
completed: 2026-04-06
---

# Phase 1 Plan 1: DB Schema, Types, and Suppression List Summary

**5-table Supabase migration with GDPR-compliant lawful_basis/suppression_list, hand-written TypeScript types, and tested suppression helper using vi.mock**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T09:38:27Z
- **Completed:** 2026-04-06T09:46:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Migration creates all 5 tables (leads, email_events, scrape_jobs, email_templates, suppression_list) in one file with correct GDPR fields: `lawful_basis text NOT NULL DEFAULT 'legitimate_interest'`, `opted_out boolean NOT NULL DEFAULT false`, `email text PRIMARY KEY` on suppression_list
- Hand-written TypeScript types for all 5 tables exported from lib/db/types.ts, matching schema exactly
- `isEmailSuppressed()` and `addToSuppressionList()` implemented with email normalization — 4 unit tests pass without any real DB connection

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Supabase migration and TypeScript DB types** - `53998d5` (feat)
2. **Task 2: Build suppression list helper and tests (MAIL-08)** - `5ea5de2` (feat)

**Plan metadata:** _(to be added after final commit)_

## Files Created/Modified

- `supabase/migrations/20260406000001_initial_schema.sql` - 5-table initial schema with GDPR fields, indexes, updated_at trigger
- `lib/db/types.ts` - Hand-written TypeScript types: Lead, LeadStatus, EmailEvent, ScrapeJob, EmailTemplate, SuppressionEntry
- `lib/db/suppression.ts` - isEmailSuppressed() and addToSuppressionList() with email normalization
- `lib/supabase/server.ts` - Stub for server-side Supabase client (throws at runtime, vi.mock replaces in tests)
- `tests/suppression.test.ts` - 4 unit tests: true when suppressed, false when not, lowercase normalization, upsert call
- `vitest.config.ts` - Vitest configured with node environment, @/ alias, tests/**/*.test.ts pattern
- `package.json` - Added test/test:watch scripts, vitest devDependency

## Decisions Made

- Created `lib/supabase/server.ts` stub so `vi.mock('@/lib/supabase/server')` can intercept the import in unit tests without requiring the real `@supabase/ssr` implementation. Plan 01-03 will overwrite this file with the full implementation.
- Suppression list checks by email address (not lead UUID) — this covers the re-scrape scenario where a previously opted-out contact is scraped again with a new UUID. Two defense layers: state machine (per-row) + suppression list (per-email).
- `email_events.template_id` deliberately has no FK constraint in Phase 1 (comment in migration explains this). FK added in Phase 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/supabase/server.ts stub to unblock test execution**
- **Found during:** Task 2 (suppression test run)
- **Issue:** vitest's module resolver threw "Cannot find package '@/lib/supabase/server'" before `vi.mock` could intercept it — tests could not run at all
- **Fix:** Created a minimal stub at `lib/supabase/server.ts` that exports `createClient()` throwing a descriptive runtime error. vi.mock replaces this at test time; production code path blocked until Plan 01-03 implements the real client
- **Files modified:** `lib/supabase/server.ts` (new file)
- **Verification:** `npm test -- tests/suppression.test.ts` → 4 passed
- **Committed in:** `5ea5de2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for test execution. Stub is intentional and documented — Plan 01-03 will replace it. No scope creep.

## Issues Encountered

- vitest's path alias resolution runs before vi.mock intercepts the import — the stub file was required to satisfy the module resolver even though tests mock the module entirely.

## User Setup Required

None - no external service configuration required in this plan. Supabase migration deployment happens in Plan 01-04.

## Next Phase Readiness

- Schema contract is locked: all subsequent plans can reference table names, column names, and types from lib/db/types.ts
- suppression_list check infrastructure is ready for Phase 4 email sends
- lib/supabase/server.ts stub will be replaced in Plan 01-03 when @supabase/ssr is installed
- Vitest is configured and running — Plans 01-02 and beyond can add test files to tests/

---
*Phase: 01-foundation*
*Completed: 2026-04-06*
