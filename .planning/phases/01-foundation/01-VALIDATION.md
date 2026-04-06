---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (or jest — TBD by planner) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | INFR-01 | — | N/A | integration | `supabase db push` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFR-02 | — | Invalid state transitions rejected | unit | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFR-03 | — | N/A | integration | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFR-04 | — | lawful_basis field present | unit | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFR-05 | — | N/A | integration | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAIL-07 | — | Opt-out link in emails | unit | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | MAIL-08 | — | Suppression list checked before send | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending*

---

## Wave 0 Requirements

- [ ] Test framework installation (vitest or jest)
- [ ] Test configuration file
- [ ] Database connection test helpers

*Wave 0 covers all MISSING references.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Next.js app boots and connects to Supabase | INFR-05 | Requires running dev server | Run `npm run dev`, check console for Supabase connection |
| Gmail Workspace account created | — | Operational task | Verify account exists and warmup started |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
