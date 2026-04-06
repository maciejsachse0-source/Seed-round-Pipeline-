# Roadmap: Seed Round Pipeline

**Milestone:** v1
**Created:** 2026-04-06
**Granularity:** Standard (5-8 phases)
**Total v1 Requirements:** 28

## Phases

- [ ] **Phase 1: Foundation** - Schema, infrastructure, GDPR fields, Gmail warmup start
- [ ] **Phase 2: OLX Scraper + Data Processing** - End-to-end scrape pipeline with normalization, dedup, and lead scoring
- [ ] **Phase 3: Lead Management Dashboard** - Visibility and manual control before any email is sent
- [ ] **Phase 4: Email Infrastructure** - Gmail sending + reply detection shipped together
- [ ] **Phase 5: Follow-up Sequences** - Automated sequences gated on proven reply detection
- [ ] **Phase 6: Additional Scrapers + Dashboard Enhancements** - Google Maps scraper, funnel analytics, export

---

## Phase Details

### Phase 1: Foundation
**Goal**: The project has a working database schema, job queue, Next.js shell, and GDPR-compliant data structures — and Gmail warmup has started.
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, MAIL-07, MAIL-08
**Success Criteria** (what must be TRUE):
  1. A Supabase migration runs cleanly and creates all tables: leads, email_events, scrape_jobs, email_templates, suppression_list — with lawful_basis field present from the start
  2. The lead state machine enforces valid transitions in code — invalid transitions (e.g. opted_out lead receiving a follow-up) are rejected
  3. The pg-boss job queue starts and processes a test job without error
  4. The Next.js app boots locally and connects to Supabase
  5. The suppression list table exists and is checked before any send pathway (opt-out infrastructure ready before first email)
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Supabase migration (5 tables, GDPR fields) + suppression list helper + Vitest setup
- [x] 01-02-PLAN.md — Lead state machine (9 statuses, validated transitions) + pg-boss singleton + instrumentation.ts
- [ ] 01-03-PLAN.md — Next.js app scaffold + Supabase SSR/browser clients + dashboard shell + env config
- [ ] 01-04-PLAN.md — [BLOCKING] supabase db push to live project + app verification + Gmail warmup checkpoint

### Phase 2: OLX Scraper + Data Processing
**Goal**: Scraped handmade seller leads from OLX appear in the Supabase database — normalized, deduplicated, and scored — ready for human review.
**Depends on**: Phase 1
**Requirements**: SCRP-01, SCRP-03, SCRP-04, SCRP-05, DATA-01, DATA-02, DATA-03, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Running an OLX scrape job for a given category + location produces lead records in Supabase with all required fields (name, email, phone, city, description, categories, price range, social links)
  2. Submitting duplicate leads (same email or phone) does not create duplicate records in the database
  3. Polish characters, phone number formats, and city names are normalized consistently across all ingested leads
  4. Each lead has a numeric score 0-100 stored in Supabase, reflecting activity, category match, and profile completeness
  5. The scraper respects configurable rate limits — no request bursts that would trigger a platform ban
**Plans**: TBD
**UI hint**: yes

### Phase 3: Lead Management Dashboard
**Goal**: The user can view, filter, and manually manage all scraped leads through a web dashboard before any automated outreach begins.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. User can view a paginated, filterable, sortable table of all leads with their current status and score
  2. User can manually change a lead's status (new, scored, approved, contacted, replied, interested, rejected, opted_out) and the change persists
  3. User can view the full email history for a specific lead (sent emails, reply events, status changes)
  4. User can create and edit email templates with personalization tokens ({name}, {city}, {category}) from the dashboard
  5. User can trigger a scrape job for a chosen platform and parameters directly from the dashboard
**Plans**: TBD
**UI hint**: yes

### Phase 4: Email Infrastructure
**Goal**: The user can send a cold email to an approved lead through Gmail, and the system automatically stops the sequence when a reply is detected.
**Depends on**: Phase 3
**Requirements**: MAIL-01, MAIL-02, MAIL-04, MAIL-05, MAIL-06, DATA-04
**Success Criteria** (what must be TRUE):
  1. Sending a cold email to an approved lead works via Gmail OAuth2 — email arrives in recipient inbox, not spam
  2. A lead's email address is validated via MX record check before any send; invalid addresses are skipped
  3. When a recipient replies, the system detects the reply within 15 minutes via Gmail API polling and marks the lead's sequence as stopped
  4. The system enforces the 40-50 emails/day cap and 60-120 second spacing between sends — no batch can exceed this
  5. Each sent email includes a functioning opt-out link that adds the recipient to the suppression list on click
**Plans**: TBD

### Phase 5: Follow-up Sequences
**Goal**: The system automatically sends configured follow-up emails to leads that have not replied, stopping immediately on any reply.
**Depends on**: Phase 4
**Requirements**: MAIL-03, SCRP-06
**Success Criteria** (what must be TRUE):
  1. A lead that has not replied receives follow-up emails according to the configured sequence (default: 2 follow-ups, minimum 5-day gaps between each)
  2. A lead that replies at any point in the sequence receives no further follow-up emails from that sequence
  3. User can configure the number of follow-ups and the interval between emails per sequence from the dashboard
  4. User can manually trigger a scrape job from the dashboard and see its progress/status in real time
**Plans**: TBD
**UI hint**: yes

### Phase 6: Additional Scrapers + Dashboard Enhancements
**Goal**: The pipeline covers a second lead source (Google Maps) and the dashboard provides funnel analytics and data export for operational decision-making.
**Depends on**: Phase 5
**Requirements**: SCRP-02, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Running a Google Maps scrape job for a given location and category produces leads in Supabase using the same adapter interface as OLX
  2. User can view a funnel analytics view showing conversion counts per pipeline stage (new → contacted → replied → interested) broken down by source platform
  3. User can export all interested/approved sellers to a CSV or JSON file from the dashboard
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/4 | In Progress|  |
| 2. OLX Scraper + Data Processing | 0/? | Not started | - |
| 3. Lead Management Dashboard | 0/? | Not started | - |
| 4. Email Infrastructure | 0/? | Not started | - |
| 5. Follow-up Sequences | 0/? | Not started | - |
| 6. Additional Scrapers + Dashboard Enhancements | 0/? | Not started | - |

---
*Roadmap created: 2026-04-06*
*Last updated: 2026-04-06 — Phase 1 plans created (4 plans, 3 waves)*
