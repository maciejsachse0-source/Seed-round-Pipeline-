---
phase: 2
slug: olx-scraper-data-processing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After each wave:** Run full suite + TypeScript check (`npx tsc --noEmit`)
- **Before phase verification:** Full suite + live Supabase query check

---

## Wave 0 Checklist

- [ ] Verify OLX phone reveal mechanism (JS-gated vs static)
- [ ] Confirm OLX listing page CSS selectors
- [ ] Install new dependencies (got, cheerio, playwright, p-limit, libphonenumber-js)
- [ ] Apply email nullable migration to Supabase

---

## Critical Test Cases

| # | What to test | How | Nyquist? |
|---|-------------|-----|----------|
| 1 | OLX listing page parsing | Unit test with HTML fixture | Yes |
| 2 | Phone number normalization (Polish formats) | Unit test with edge cases | Yes |
| 3 | Lead deduplication (same email/phone) | Integration test against Supabase | Yes |
| 4 | Lead scoring algorithm (0-100 range) | Unit test with sample leads | Yes |
| 5 | Rate limiting respects config | Unit test with timing assertions | Yes |
| 6 | Zod schema validation rejects bad data | Unit test with invalid fixtures | Yes |
| 7 | Polish character normalization | Unit test with diacritics | Yes |
