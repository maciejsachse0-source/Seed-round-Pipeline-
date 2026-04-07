---
phase: 4
slug: email-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 4 — Validation Strategy

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
- **Before phase verification:** Full suite + manual Gmail send test

---

## Critical Test Cases

| # | What to test | How | Nyquist? |
|---|-------------|-----|----------|
| 1 | MX record validation rejects invalid domains | Unit test with mock DNS | Yes |
| 2 | Daily send cap enforced (40-50/day) | Unit test with counter logic | Yes |
| 3 | Send spacing (60-120s) between emails | Unit test with timing | Yes |
| 4 | Suppression list checked before send | Unit test | Yes |
| 5 | Opt-out link HMAC generation/verification | Unit test | Yes |
| 6 | Reply detection marks lead as replied | Unit test with mock Gmail API | Yes |
| 7 | retryLimit: 0 on email jobs | Unit test on job config | Yes |
| 8 | substituteTokens used in email body | Integration test | Yes |
