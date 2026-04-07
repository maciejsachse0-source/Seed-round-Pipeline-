---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 4
current_plan: Not started
status: planning
last_updated: "2026-04-07T11:25:13.619Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# State: Seed Round Pipeline

**Last updated:** 2026-04-06
**Session:** Completed Phase 1 Plan 3, ready for Plan 4

---

## Project Reference

**Core Value:** Automatyczne budowanie bazy zainteresowanych sprzedawców handmade — od znalezienia kontaktu do uzyskania zgody na współpracę.

**In one sentence:** Scrape handmade seller contacts from Polish platforms, score them, and run personalized cold email sequences — all managed from a web dashboard.

---

## Current Position

Phase: 03 (lead-management-dashboard) — EXECUTING
Plan: 1 of 3
**Milestone:** v1
**Current Phase:** 4
**Current Plan:** Not started
**Status:** Ready to plan

**Progress:**

```
[████████░░] 75% (3/4 plans complete)
Phase 1: Foundation                          [3/4 plans] In progress
Phase 2: OLX Scraper + Data Processing      [ ] Not started
Phase 3: Lead Management Dashboard          [ ] Not started
Phase 4: Email Infrastructure               [ ] Not started
Phase 5: Follow-up Sequences               [ ] Not started
Phase 6: Additional Scrapers + Enhancements [ ] Not started
```

Overall: 0/6 phases complete (3/4 plans complete in Phase 1)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements defined | 28 |
| Requirements mapped | 28 |
| Phases planned | 6 |
| Plans created | 4 |
| Plans complete | 3 |

### Execution Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-foundation P01 | 8 min | 2 tasks | 7 files |
| Phase 01-foundation P02 | 8 min | 2 tasks | 5 files |
| Phase 01-foundation P03 | 12 min | 2 tasks | 13 files |

---

## Accumulated Context

### Key Decisions Locked In

- **Vitest 4.x mock class syntax:** Use `class MockX { ... }` not `vi.fn().mockImplementation(() => ({...}))` when mocking constructors — vi.fn() produces arrow functions, which cannot be used with `new`
- **Schema-first:** lawful_basis, suppression_list, and state machine must exist from day 1 — cannot be retrofitted without GDPR exposure
- **OLX before social scrapers:** Most accessible Polish platform; establishes adapter pattern before tackling unreliable Facebook/Instagram
- **Dashboard before email:** Manual lead review is the quality gate protecting Gmail sender reputation
- **Reply detection ships with email (Phase 4):** Follow-up sequencer is unsafe without it — hard dependency, not nice-to-have
- **Gmail warmup starts in Phase 1:** Warmup takes 2-3 weeks; must begin immediately or email phases are blocked
- **Google Workspace required (not @gmail.com):** Free Gmail accounts soft-banned well below 500/day limit at cold email patterns
- **lib/supabase/server.ts stub replaced:** Plan 01-03 replaced the stub with real @supabase/ssr createServerClient using await cookies() — @/lib/supabase/server import now resolves fully
- **Suppression list checks by email not UUID** — covers re-scrape scenario; isEmailSuppressed() is the absolute send barrier regardless of lead.status
- **pg-boss named export only:** pg-boss exports `{PgBoss}` as a named export, not a default export — use `import { PgBoss } from 'pg-boss'` everywhere
- **Supabase ANON_KEY only in NEXT_PUBLIC_:** Service role key must never use NEXT_PUBLIC_ prefix — .env.local template deliberately omits service role key (threat T-03-01)

### Critical Non-Negotiables (from research)

- RODO: lawful_basis field in schema from day 1
- RODO: opt-out link in every email (MAIL-07)
- RODO: suppression list checked before every send (MAIL-08)
- Gmail: hard cap 40-50 emails/day, 60-120s between sends
- Gmail: validate emails via MX record before sending (prevents bounce cascade)
- State machine: define all transitions before writing schema

### Open Items

- [ ] Gmail Workspace account needs to be created before Phase 1 ends — warmup must start immediately
- [ ] RODO Legitimate Interest Assessment (LIA) needs to be drafted by operator before Phase 4 — this is legal work, not engineering
- [ ] Verify playwright-extra stealth compatibility with current Playwright version before Phase 2 implementation
- [ ] Decide: Google Maps scraper via Places API (cost?) vs Playwright (fragility?) — validate before Phase 6 planning
- [ ] Real Supabase values needed in .env.local before npm run dev can connect to database (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL)

### Research Flags for Planning

- **Phase 4 planning:** Gmail OAuth2 token refresh edge cases, Gmail API polling rate limits, bounce classification (soft vs hard) — do a focused research pass
- **Phase 6 planning:** Facebook/Instagram scraper viability — validate playwright-extra stealth effectiveness at planning time

---

## Session Continuity

### How to Resume

1. Read this file
2. Read `.planning/ROADMAP.md` for phase structure
3. Execute Plan 01-04 (Supabase migration deployment + Gmail Workspace checkpoint)

### Last Actions

- 2026-04-06: Roadmap created with 6 phases, 28 requirements mapped
- 2026-04-06: STATE.md initialized
- 2026-04-06: Executed Plan 01-01 — DB schema migration, TypeScript types, suppression helper, 4 tests passing. Commits: 53998d5, 5ea5de2
- 2026-04-06: Executed Plan 01-02 — Lead state machine (25 tests), pg-boss singleton, instrumentation.ts. 32 total tests passing. Commits: c57c9ec, e413c0e, 552733c
- 2026-04-06: Executed Plan 01-03 — Next.js scaffold, Supabase SSR clients (replaced stub), dashboard shell, tsconfig @/ alias, .gitignore, .env.local. 32 tests passing, tsc clean. Commits: 612ffe4, 0e689e1

---
*State initialized: 2026-04-06*
