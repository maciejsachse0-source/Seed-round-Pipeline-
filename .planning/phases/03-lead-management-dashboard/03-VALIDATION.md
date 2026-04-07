---
phase: 3
slug: lead-management-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After each wave:** Run full suite + TypeScript check (`npx tsc --noEmit`)
- **Before phase verification:** Full suite + manual browser check of dashboard

---

## Critical Test Cases

| # | What to test | How | Nyquist? |
|---|-------------|-----|----------|
| 1 | Lead table renders with data | Unit test with mock Supabase data | Yes |
| 2 | Status change persists via Server Action | Integration test | Yes |
| 3 | assertTransition called before status update | Unit test | Yes |
| 4 | Pagination with searchParams | Unit test | Yes |
| 5 | Email template CRUD | Integration test | Yes |
| 6 | Scrape job trigger calls POST /api/scrape | Unit test | Yes |
| 7 | Filter by status/score works | Unit test | Yes |
