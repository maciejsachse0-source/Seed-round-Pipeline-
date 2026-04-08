---
phase: 05-follow-up-sequences
plan: 01
subsystem: email
tags: [pg-boss, follow-up, sequence, nodemailer, gmail]

# Dependency graph
requires:
  - phase: 04-email-infrastructure
    provides: sendColdEmail, email-worker, reply-check-worker, pg-boss queue
provides:
  - scheduleFollowUp function for deferred pg-boss job scheduling
  - follow-up-worker that sends follow-ups with all stop conditions
  - sendColdEmail targetStatus + sequenceNumber params
  - sequence_config singleton table migration
  - getSequenceConfig and updateSequenceConfig DB helpers
  - email-worker triggers follow-up chain after successful cold email
affects: [05-follow-up-sequences plan 02, dashboard sequence config UI]

# Tech tracking
tech-stack:
  added: []
  patterns: [self-scheduling chain pattern for follow-up sequences, targetStatus parameterization of sendColdEmail]

key-files:
  created:
    - supabase/migrations/20260408000001_sequence_config.sql
    - lib/queries/sequence-config.ts
    - lib/email/follow-up.ts
    - lib/queue/workers/follow-up-worker.ts
    - tests/email/follow-up.test.ts
    - tests/queue/follow-up-worker.test.ts
  modified:
    - lib/db/types.ts
    - lib/email/send.ts
    - lib/queue/workers/email-worker.ts
    - instrumentation.ts

key-decisions:
  - "Self-scheduling chain: each send schedules the next via boss.send with startAfter delay -- no cron scanner needed"
  - "sendColdEmail gets optional third param {targetStatus, sequenceNumber} -- backward compatible, defaults preserve Phase 4 behavior"
  - "sequence_config is a singleton table with CHECK(id=1) constraint -- simpler than per-sequence table for v1"

patterns-established:
  - "Self-scheduling chain: after successful send, enqueue next step with deferred startAfter"
  - "Follow-up worker status guard: only CONTACTED and FOLLOWED_UP are active sequence statuses"
  - "Dynamic import in email-worker for follow-up scheduling to avoid circular dependencies"

requirements-completed: [MAIL-03]

# Metrics
duration: 8min
completed: 2026-04-08
---

# Phase 5 Plan 1: Follow-up Sequences Core Summary

**Self-scheduling follow-up chain with pg-boss deferred jobs, configurable sequence_config, and sendColdEmail targetStatus parameterization**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-08T07:39:00Z
- **Completed:** 2026-04-08T07:47:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Self-scheduling follow-up chain: cold email -> follow-up 1 (5 days) -> follow-up 2 (5 days) -> done
- All stop conditions enforced: replied, opted_out, approved, lead not found, no template
- sendColdEmail now supports follow-up sends with targetStatus=FOLLOWED_UP and custom sequenceNumber
- 233 tests passing (23 new), zero regressions

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Migration + types + scheduling library + sendColdEmail fix**
   - `5c9ea68` (test: failing tests for scheduleFollowUp)
   - `db05a48` (feat: migration, types, scheduling library, sendColdEmail targetStatus)
2. **Task 2: Follow-up worker + email-worker wiring + instrumentation**
   - `e5e8c87` (test: failing tests for follow-up worker)
   - `3165698` (feat: follow-up worker, email-worker wiring, instrumentation)

## Files Created/Modified
- `supabase/migrations/20260408000001_sequence_config.sql` - Singleton config table with default row (max_follow_ups=2, interval_days=5)
- `lib/db/types.ts` - Added SequenceConfig interface
- `lib/queries/sequence-config.ts` - getSequenceConfig and updateSequenceConfig DB helpers with fallback
- `lib/email/follow-up.ts` - scheduleFollowUp, getSequenceConfigForScheduler, DEFAULT_SEQUENCE_CONFIG
- `lib/email/send.ts` - Added optional {targetStatus, sequenceNumber} third param to sendColdEmail
- `lib/queue/workers/follow-up-worker.ts` - pg-boss worker for follow-up-send queue with all stop conditions
- `lib/queue/workers/email-worker.ts` - Schedules first follow-up (step 1) after successful cold email
- `instrumentation.ts` - Registers follow-up worker at server startup
- `tests/email/follow-up.test.ts` - 12 tests for scheduleFollowUp and getSequenceConfigForScheduler
- `tests/queue/follow-up-worker.test.ts` - 11 tests for follow-up worker stop conditions and send flow

## Decisions Made
- Self-scheduling chain pattern chosen over cron scanner -- explicit, no duplicate risk, no polling overhead
- sendColdEmail third param defaults preserve exact Phase 4 behavior -- fully backward compatible
- sequence_config singleton table (not per-sequence) -- simpler for v1 single-sequence use case
- Dynamic import of follow-up module in email-worker to avoid circular dependency

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already committed (RED: 5c9ea68, GREEN: db05a48) from a prior execution attempt; Task 2 was executed fresh.

## Issues Encountered
- Pre-existing TypeScript error in `app/api/track/open/[eventId]/route.ts` (Property 'catch' does not exist on type 'PromiseLike<void>') -- not caused by this plan's changes, not in scope

## User Setup Required

None - no external service configuration required. The sequence_config migration must be applied via `supabase db push` before follow-ups can use DB-stored config (falls back to defaults if not applied).

## Next Phase Readiness
- Follow-up sequencer core is complete and tested
- Plan 02 (sequence config API + dashboard UI + scrape trigger verification) can proceed
- Templates with sequence_position=1 and sequence_position=2 must be created by the user for follow-ups to actually send

## Self-Check: PASSED

All 10 files found. All 4 commits verified (5c9ea68, db05a48, e5e8c87, 3165698).

---
*Phase: 05-follow-up-sequences*
*Completed: 2026-04-08*
