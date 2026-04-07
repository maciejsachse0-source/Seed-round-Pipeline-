---
phase: 02-olx-scraper-data-processing
plan: "02"
subsystem: pipeline
tags: [normalization, scoring, tdd, pure-functions, libphonenumber-js]
dependency_graph:
  requires: [02-01]
  provides: [lib/pipeline/normalize.ts, lib/pipeline/score.ts]
  affects: [ingestion pipeline, lead DB writes]
tech_stack:
  added: [libphonenumber-js]
  patterns: [pure-functions, tdd-red-green, weighted-scoring]
key_files:
  created:
    - lib/pipeline/normalize.ts
    - lib/pipeline/score.ts
    - tests/normalize.test.ts
    - tests/score.test.ts
  modified: []
decisions:
  - "sellerType='private' used in phone-only and phone+email scoring tests to produce expected values (23 and 33)"
  - "CITY_ALIASES uses ASCII-only keys to handle both diacritic and non-diacritic OLX city output via NFC+toLowerCase lookup"
  - "scoreLead clamps with Math.min(100, Math.round(score)) so floating-point activity component cannot exceed bounds"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-07"
  tasks_completed: 4
  files_created: 4
  files_modified: 0
---

# Phase 02 Plan 02: Polish Normalization + Lead Scoring Summary

**One-liner:** Polish phone E.164 normalization via libphonenumber-js and 0-100 weighted lead scoring across 5 signal dimensions implemented as pure functions with full TDD coverage.

## What Was Built

Two pure-function modules that all scraped leads pass through before database insertion:

### lib/pipeline/normalize.ts

- `normalizePolishPhone(raw)` — parses Polish phone numbers in any format (+48, 0048, local 9-digit, landline with parentheses/dashes) using libphonenumber-js with PL default country. Returns E.164 format or null. Null-safe, try/catch wrapped.
- `normalizeCity(raw)` — maps 10 major Polish cities to canonical ASCII names via CITY_ALIASES (e.g. 'warszawa' -> 'Warszawa', 'KRAKOW' -> 'Krakow'). NFC + toLowerCase normalization before lookup. Passthrough + trim for unknown cities.
- `normalizePolishText(raw)` — NFC normalize + trim. Null-safe.

### lib/pipeline/score.ts

- `ScoringSignals` interface — 8 fields: hasEmail, hasPhone, hasSocialLinks, hasDescription, hasPriceRange, listingCount, categoryMatch (0-1), sellerType.
- `SCORING_WEIGHTS` const — 5 dimensions summing to 100: contactCompleteness(30), profileCompleteness(25), activity(25), categoryMatch(15), sellerType(5).
- `scoreLead(signals)` — pure function returning 0-100 integer. Activity uses `Math.min(listingCount, 10)/10*25` to normalize high listing counts. Output clamped with `Math.min(100, Math.round(score))`.

## Test Results

- **normalize.test.ts:** 20 tests — 8 phone cases, 9 city cases, 3 text cases
- **score.test.ts:** 11 tests — 8 scoreLead cases + 3 SCORING_WEIGHTS cases
- **Full suite:** 77/77 tests pass (7 test files including Phase 1 tests)
- **TypeScript:** `npx tsc --noEmit` — zero errors

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| sellerType='private' for phone-only test | Plan note clarifies: using 'unknown'=0 gives 20, 'private'=3 gives 23. Tests use 'private' to match expected 23 and 33 values. |
| ASCII-only CITY_ALIASES keys | OLX outputs cities both with diacritics (Krakow) and without (krakow). NFC + toLowerCase on input means both paths hit the same alias key. |
| isPossiblePhoneNumber + isValid() double check | Prevents false positives from parsePhoneNumber partial parsing on strings like '123' |

## Deviations from Plan

**1. [Rule 3 - Blocking] npm install required in worktree**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Worktree had empty node_modules — libphonenumber-js not installed
- **Fix:** Ran `npm install` in worktree directory
- **Files modified:** node_modules/ (not committed)
- **Commit:** n/a (no code change)

**2. [Rule 2 - Missing Functionality] Added isPossiblePhoneNumber guard**
- **Found during:** Task 2 implementation
- **Issue:** parsePhoneNumber alone can produce objects for some non-phone strings; double-checking with isPossiblePhoneNumber + isValid() prevents false positives
- **Fix:** Added dual validation: `isPossiblePhoneNumber(cleaned, 'PL') && parsed.isValid()`
- **Files modified:** lib/pipeline/normalize.ts
- **Commit:** d0f7577

## Known Stubs

None — all functions are fully implemented and wired. No placeholder data flows.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. Both modules are internal pure functions processing already-validated data.

## Self-Check: PASSED

- [x] lib/pipeline/normalize.ts exists: FOUND
- [x] lib/pipeline/score.ts exists: FOUND
- [x] tests/normalize.test.ts exists: FOUND
- [x] tests/score.test.ts exists: FOUND
- [x] Commit fc8c2ad exists (RED normalize tests)
- [x] Commit d0f7577 exists (GREEN normalize impl)
- [x] Commit 3020afb exists (RED score tests)
- [x] Commit 06b1772 exists (GREEN score impl)
- [x] 77/77 tests pass
- [x] TypeScript clean
