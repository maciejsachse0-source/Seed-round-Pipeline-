# State: Seed Round Pipeline

**Last updated:** 2026-04-06
**Session:** Roadmap creation

---

## Project Reference

**Core Value:** Automatyczne budowanie bazy zainteresowanych sprzedawców handmade — od znalezienia kontaktu do uzyskania zgody na współpracę.

**In one sentence:** Scrape handmade seller contacts from Polish platforms, score them, and run personalized cold email sequences — all managed from a web dashboard.

---

## Current Position

**Milestone:** v1
**Current Phase:** Not started
**Current Plan:** None
**Status:** Roadmap complete — ready to begin Phase 1

**Progress:**
```
Phase 1: Foundation                          [ ] Not started
Phase 2: OLX Scraper + Data Processing      [ ] Not started
Phase 3: Lead Management Dashboard          [ ] Not started
Phase 4: Email Infrastructure               [ ] Not started
Phase 5: Follow-up Sequences               [ ] Not started
Phase 6: Additional Scrapers + Enhancements [ ] Not started
```

Overall: 0/6 phases complete

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements defined | 28 |
| Requirements mapped | 28 |
| Phases planned | 6 |
| Plans created | 0 |
| Plans complete | 0 |

---

## Accumulated Context

### Key Decisions Locked In

- **Schema-first:** lawful_basis, suppression_list, and state machine must exist from day 1 — cannot be retrofitted without GDPR exposure
- **OLX before social scrapers:** Most accessible Polish platform; establishes adapter pattern before tackling unreliable Facebook/Instagram
- **Dashboard before email:** Manual lead review is the quality gate protecting Gmail sender reputation
- **Reply detection ships with email (Phase 4):** Follow-up sequencer is unsafe without it — hard dependency, not nice-to-have
- **Gmail warmup starts in Phase 1:** Warmup takes 2-3 weeks; must begin immediately or email phases are blocked
- **Google Workspace required (not @gmail.com):** Free Gmail accounts soft-banned well below 500/day limit at cold email patterns

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

### Research Flags for Planning

- **Phase 4 planning:** Gmail OAuth2 token refresh edge cases, Gmail API polling rate limits, bounce classification (soft vs hard) — do a focused research pass
- **Phase 6 planning:** Facebook/Instagram scraper viability — validate playwright-extra stealth effectiveness at planning time

---

## Session Continuity

### How to Resume

1. Read this file
2. Read `.planning/ROADMAP.md` for phase structure
3. Run `/gsd-plan-phase 1` to begin Phase 1 planning

### Last Actions

- 2026-04-06: Roadmap created with 6 phases, 28 requirements mapped
- 2026-04-06: STATE.md initialized

---
*State initialized: 2026-04-06*
