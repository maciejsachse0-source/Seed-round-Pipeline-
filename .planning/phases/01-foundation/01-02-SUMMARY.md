---
phase: 01-foundation
plan: 02
subsystem: state-machine, queue
tags: [state-machine, pg-boss, infra, tdd, gdpr]
dependency_graph:
  requires: ["01-01"]
  provides: ["lead state machine", "pg-boss singleton", "instrumentation hook"]
  affects: ["02-*", "04-*", "05-*"]
tech_stack:
  added: ["pg-boss@12.15.0"]
  patterns: ["globalThis singleton", "TDD red-green", "Next.js instrumentation.ts"]
key_files:
  created:
    - lib/state-machine/lead-states.ts
    - lib/queue/boss.ts
    - instrumentation.ts
    - tests/state-machine.test.ts
    - tests/queue.test.ts
  modified: []
decisions:
  - "Used class syntax in vi.mock for Vitest 4.x constructor compatibility"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-06T09:47:00Z"
  tasks_completed: 2
  files_created: 5
  tests_added: 28
---

# Phase 1 Plan 2: Lead State Machine + pg-boss Singleton Summary

**One-liner:** Pure TypeScript lead state machine with 9 statuses and validated transitions, plus pg-boss singleton via globalThis pattern initialized through Next.js instrumentation.ts.

---

## What Was Built

### Task 1: Lead State Machine (INFR-02)

`lib/state-machine/lead-states.ts` implements:

- `LeadStatus` enum with exactly 9 values: `new`, `scored`, `approved`, `contacted`, `followed_up`, `replied`, `interested`, `rejected`, `opted_out`
- `VALID_TRANSITIONS` map covering all 9 states — `rejected` and `opted_out` are terminal (empty arrays)
- All 7 active states have `opted_out` as a valid destination (GDPR compliance)
- `canTransition(from, to)` — boolean guard, no throws
- `assertTransition(from, to)` — throws `Error('Invalid lead transition: {from} -> {to}')` for invalid transitions

**Test coverage:** 25 tests across `canTransition`, `assertTransition`, terminal state enforcement, and all-active-states-to-opted_out coverage.

### Task 2: pg-boss Singleton + instrumentation.ts (INFR-03)

`lib/queue/boss.ts` implements:

- `getBoss()` async function using `globalThis` singleton pattern (survives Next.js hot-reload)
- `DATABASE_URL` env var validation with explicit error pointing to direct connection string (port 5432, not pooler)
- Error logging via `boss.on('error', ...)` event handler

`instrumentation.ts` (project root):

- `register()` function guarded by `NEXT_RUNTIME === 'nodejs'`
- Dynamic import of `getBoss()` to prevent client bundle inclusion
- Try/catch around startup — logs error but does not crash the server

**Test coverage:** 3 tests covering DATABASE_URL missing error, instance creation, and singleton identity.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock class syntax for Vitest 4.x**
- **Found during:** Task 2 test execution
- **Issue:** Plan's mock used `vi.fn().mockImplementation(() => ({...}))` for PgBoss constructor mock. Vitest 4.x requires the mock to be a `class`, not an arrow function, when used with `new` keyword. The `vi.fn()` pattern produces an arrow function internally which cannot be used as a constructor.
- **Fix:** Changed mock from `const MockPgBoss = vi.fn().mockImplementation(() => ({...}))` to `class MockPgBoss { on = vi.fn(); start = vi.fn()... }`
- **Files modified:** `tests/queue.test.ts`
- **Commit:** 552733c

---

## Test Results

```
Test Files  3 passed (3)
     Tests  32 passed (32)
  Duration  ~230ms
```

- `tests/state-machine.test.ts`: 25 passed
- `tests/queue.test.ts`: 3 passed
- `tests/suppression.test.ts`: 4 passed (pre-existing from Plan 01-01)

---

## Security Notes (Threat Model Compliance)

| Threat ID | Status |
|-----------|--------|
| T-02-01 | Mitigated — `DATABASE_URL` read only from `process.env`, never logged or hardcoded |
| T-02-02 | Mitigated — `assertTransition()` JSDoc explicitly states "Call this before every lead.status update in the database" |
| T-02-03 | Accepted — pg-boss workers on persistent Node.js process only, not serverless |
| T-02-04 | Mitigated — error message in `getBoss()` explicitly names pooler as the wrong connection string |

---

## Known Stubs

None — all modules are fully implemented with real logic. No placeholder values or hardcoded empty returns.

---

## Commits

| Commit | Message |
|--------|---------|
| c57c9ec | test(01-02): add failing tests for lead state machine (INFR-02) |
| e413c0e | feat(01-02): implement lead state machine with full test coverage (INFR-02) |
| 552733c | feat(01-02): implement pg-boss singleton and Next.js instrumentation hook (INFR-03) |

---

## Self-Check: PASSED

- [x] `lib/state-machine/lead-states.ts` exists
- [x] `lib/queue/boss.ts` exists
- [x] `instrumentation.ts` exists at project root
- [x] `tests/state-machine.test.ts` exists
- [x] `tests/queue.test.ts` exists
- [x] All commits present: c57c9ec, e413c0e, 552733c
- [x] All 32 tests pass
