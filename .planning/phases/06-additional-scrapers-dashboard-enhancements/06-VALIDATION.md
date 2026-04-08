---
phase: 06
slug: additional-scrapers-dashboard-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~9 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 9 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SCRP-02 | T-06-01 | API key never exposed in client code | unit | `npx vitest run tests/scrapers/google-maps` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SCRP-02 | — | N/A | unit | `npx vitest run tests/scrapers/google-maps` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | DASH-04 | — | N/A | unit | `npx vitest run tests/queries/funnel` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | DASH-05 | — | N/A | unit | `npx vitest run tests/api/export` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scrapers/google-maps.test.ts` — stubs for SCRP-02
- [ ] `tests/queries/funnel.test.ts` — stubs for DASH-04
- [ ] `tests/api/export.test.ts` — stubs for DASH-05

*Existing infrastructure (vitest, test helpers) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Maps API key works | SCRP-02 | Requires live API key | Run scraper with real key, verify results in DB |
| Dashboard nav shows new pages | DASH-04, DASH-05 | Visual verification | Open /dashboard, check sidebar links |
| CSV download triggers browser save | DASH-05 | Browser behavior | Click export link, verify file downloads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 9s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
