---
phase: 5
slug: follow-up-sequences
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 5 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After each wave:** Full suite + TypeScript check
- **Before phase verification:** Full suite green

---

## Critical Test Cases

| # | What to test | How | Nyquist? |
|---|-------------|-----|----------|
| 1 | Follow-up scheduled with correct startAfter delay | Unit test | Yes |
| 2 | Reply stops sequence (no further follow-ups) | Unit test | Yes |
| 3 | Max follow-ups respected | Unit test | Yes |
| 4 | sendColdEmail works for followed_up status | Unit test | Yes |
| 5 | Sequence config CRUD from dashboard | Unit test | Yes |
| 6 | Daily cap shared between initial + follow-up sends | Unit test | Yes |
