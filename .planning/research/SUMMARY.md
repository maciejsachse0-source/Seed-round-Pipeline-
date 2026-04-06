# Project Research Summary

**Project:** Seed Round Pipeline
**Domain:** Lead generation / cold outreach pipeline for handmade marketplace (Polish market)
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

This is a targeted cold outreach pipeline for discovering and contacting handmade/craft business sellers across Polish platforms (OLX, Facebook, Instagram, Google Maps) and nurturing them as marketplace sellers. Experts in this domain build modular scraper adapters per platform, rely on PostgreSQL-backed job queues for durable scheduling, and treat Gmail account health as a first-class concern rather than an afterthought. The recommended approach: start with OLX scraping (most accessible, Cloudflare-protected but crackable with Playwright + stealth), build the data normalization and scoring layer before email, and gate all sending behind reply detection to prevent follow-ups after a reply lands.

The stack is lean by design: Playwright + Cheerio for scraping, Nodemailer + Gmail OAuth2 for sending, pg-boss on Supabase PostgreSQL for job queuing (no Redis needed), and Next.js for the dashboard. Every component has been chosen to avoid external service dependencies that add cost without proportional value at the 100-500 lead scale this pipeline targets. Supabase serves as both the database and the CRM — no external CRM integration needed.

The two highest-stakes risks are Gmail account health and RODO compliance. A Gmail account sending cold email patterns from a free @gmail.com address will be soft-banned well below the documented 500/day limit — a Google Workspace account with custom domain is required, warmed up over 2-3 weeks before production use. On the compliance side, only scraping business sellers (JDG), documenting a Legitimate Interest Assessment, and shipping a suppression list + opt-out link from day one are non-negotiable, not v2 items.

## Key Findings

### Recommended Stack

The stack prioritises zero-cost external dependencies by leveraging the existing Supabase PostgreSQL instance for job durability (pg-boss) rather than introducing Redis (BullMQ rejected). Playwright is the clear choice over Puppeteer for new projects — multi-browser, stealth plugin support, faster development cadence. Cheerio handles static pages 10-100x faster than a headless browser and should be used wherever JS rendering is not required.

See [STACK.md](.planning/research/STACK.md) for full rationale.

**Core technologies:**
- **Playwright (~1.44) + playwright-extra stealth:** JS-heavy platform scraping (Facebook, Instagram, OLX) — superior to Puppeteer, handles login sessions, SPA rendering, fingerprint evasion
- **Cheerio (~1.0):** Static HTML parsing — use for OLX listing pages and any server-rendered content for speed
- **Nodemailer (~6.9) + googleapis (~140.x):** Gmail sending via OAuth2 and inbox polling for reply detection — no paid email service needed at this scale
- **pg-boss (~9.x):** Durable job queue backed by Supabase PostgreSQL — survives restarts, supports delay/retry/cron, no Redis required
- **Next.js:** Dashboard — Server Components + Server Actions pattern, minimal client-side complexity
- **@supabase/supabase-js + Zod + p-limit:** Database client, schema validation, concurrency capping

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for full table.

**Must have (table stakes):**
- Contact data collection with source platform tagging — foundation of the pipeline
- Lead deduplication on email address — prevents multi-sends to same person
- Per-lead status state machine (new → contacted → replied → interested/rejected/opted_out) — controls all automation
- Gmail SMTP sending with OAuth2 — core outreach mechanism
- Template engine with personalization tokens ({name}, {city}, {category}) — required for deliverability
- Reply detection with auto-stop — must ship before follow-up sequences
- Automated follow-up sequences (gated behind reply detection) — core value
- Send rate limiting/throttle — Gmail protection
- Opt-out/unsubscribe in every email — GDPR/RODO legal requirement

**Should have (competitive differentiators):**
- Automated lead scoring — prioritises limited Gmail quota on best leads
- Multi-field data enrichment (city, phone, what they sell, price range) — powers personalization
- Configurable follow-up count and intervals — operator control
- Dashboard funnel analytics — visibility into conversion rates per stage
- Scrape run scheduling via cron — reduces manual intervention
- Scraper health monitoring — catches platform blocks early
- Bulk dashboard actions + CSV/JSON export — operational efficiency

**Defer (v2+):**
- Email open tracking — adds tracking pixel complexity
- AI-generated copy per lead — templates with tokens are sufficient for v1
- Multi-account Gmail rotation — not justified at 100-500 leads scale
- SMS/WhatsApp automation — different compliance domain
- CRM integrations — Supabase IS the CRM for this use case

### Architecture Approach

The system is organized as 7 discrete components: per-platform scraper adapters (each independent), a normalization + deduplication layer, a lead scoring engine, an email sequencer, a reply listener, a Next.js dashboard, and Supabase as the system of record. The key architectural insight is that scraper adapters share a common `scrape(config) -> Lead[]` interface but are otherwise fully isolated — Facebook/Instagram unreliability cannot cascade into OLX scraping. The pg-boss job queue ties everything together with durable, retryable execution.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full schema and data flow diagram.

**Major components:**
1. **Scraper Adapters (per platform)** — isolated modules with own rate limiting; OLX first, social media last
2. **Normalization + Deduplication Layer** — Zod validation, email dedup, Polish character normalization
3. **Lead Scoring Engine** — weighted rule-based TypeScript module, numeric score stored in Supabase
4. **Email Sequencer** — manages sequences per lead, respects Gmail send caps, delays between sends
5. **Reply Listener** — polls Gmail every 5-15 min via Gmail API, matches by thread ID, auto-stops sequences
6. **Next.js Dashboard** — lead table, status management, scraper triggers, funnel analytics
7. **Supabase (system of record)** — leads, email_events, scrape_jobs, email_templates, suppression_list tables

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for full prevention strategies and phase assignments.

1. **Gmail account ban from cold email patterns** — use Google Workspace + custom domain (not @gmail.com), warm up over 2-3 weeks starting at 5/day, hard cap at 40-50/day in production, space sends 60-120s apart
2. **RODO/GDPR non-compliance** — only scrape business sellers (JDG), add `lawful_basis` field to schema from day 1, opt-out link in every email, maintain suppression list checked before every send, document a Legitimate Interest Assessment
3. **Platform scraping bans** — each platform gets independent adapter with own rate limiting; treat Facebook/Instagram as unreliable by design; start with OLX and Google Maps; use residential proxies for social media
4. **High bounce rate collapsing sender reputation** — scraped emails have 30-60% invalid rate; validate with MX record check before sending; pause batch if bounce rate exceeds 3%
5. **Missing lead state machine** — define all state transitions before writing the database schema; validate transitions in code to prevent impossible states like opted_out leads receiving follow-ups

## Implications for Roadmap

Based on the dependency chain identified in ARCHITECTURE.md (schema → scraping → scoring → dashboard → email → reply detection → sequences) and the pitfall phase assignments from PITFALLS.md, the recommended phase structure is:

### Phase 1: Foundation — Schema, Infrastructure, Gmail Setup

**Rationale:** Everything depends on the database schema. GDPR fields (`lawful_basis`, `opted_out`), the state machine, and the suppression list table must exist from day 1 — they cannot be retrofitted cleanly. Gmail Workspace account setup and warmup also starts here because warmup takes 2-3 weeks and blocks email phases.
**Delivers:** Supabase schema with migrations, pg-boss job queue wiring, Next.js project shell, Gmail Workspace account created and warmup started
**Addresses features:** Lead deduplication (schema), status tracking (state machine), opt-out mechanism (suppression_list table)
**Avoids:** Pitfall #2 (RODO — lawful_basis from day 1), Pitfall #5 (state machine defined before schema), Pitfall #8 (impossible lead states)

### Phase 2: OLX Scraper + Normalization + Lead Scoring

**Rationale:** OLX is the most accessible source (medium protection, no login required, most Polish handmade sellers). Build the scraping pipeline end-to-end with one source before adding more. Scoring rubric must be defined before scrapers are written so scraper fields align with scoring needs (Pitfall #5).
**Delivers:** Working OLX scraper, normalization/dedup layer, lead scoring engine, leads appearing in Supabase
**Uses:** Playwright + Cheerio, Zod, p-limit, @supabase/supabase-js
**Implements:** Scraper Adapter pattern, Normalization Layer, Lead Scoring Engine
**Avoids:** Pitfall #3 (platform isolation), Pitfall #5 (scoring rubric before scraping), Minor Pitfall #10 (p-limit for RAM), Minor Pitfall #11 (no raw HTML storage)

### Phase 3: Dashboard — Lead Management

**Rationale:** Before sending any email, operators need visibility and control. Manual review of scraped leads is a quality gate — sending to unreviewed leads wastes Gmail quota and risks GDPR violations. Dashboard must exist before email phase.
**Delivers:** Lead table view, status management UI, manual override, per-lead email history view, source platform tagging display
**Addresses features:** Lead table view, manual status override, source platform tagging
**Avoids:** Pitfall — sending without manual approval

### Phase 4: Email Infrastructure — Sending + Reply Detection

**Rationale:** Reply detection must ship in the same phase as sending (or before follow-ups) — this is the hardest dependency in the system. FEATURES.md explicitly flags this: "Reply detection must ship before follow-up automation." Gmail OAuth2 setup, send rate limiting, bounce tracking, and reply listener are all wired here.
**Delivers:** Gmail OAuth2 sending, template engine with tokens, send rate limiter, reply detection via Gmail API polling, bounce tracking, suppression list enforcement
**Uses:** Nodemailer, googleapis, pg-boss (email jobs)
**Implements:** Email Sequencer, Reply Listener
**Avoids:** Pitfall #1 (Gmail ban — 40-50/day cap, 60-120s spacing), Pitfall #4 (bounce rate — MX validation before send), Pitfall #7 (OAuth2 reliability over raw SMTP)

### Phase 5: Follow-up Sequences + Automation

**Rationale:** Only possible after reply detection is proven working. Automated sequences without reply detection will re-contact people who already responded, generating spam complaints and account bans.
**Delivers:** Configurable follow-up sequences (max 3 total emails per lead), minimum 5-day gaps, sequence auto-stop on reply, pg-boss delayed job scheduling
**Addresses features:** Automated follow-up sequences, configurable follow-up count/intervals
**Avoids:** Pitfall #6 (follow-up sequences triggering spam complaints)

### Phase 6: Additional Scrapers + Dashboard Enhancements

**Rationale:** OLX pattern is proven; expand to Google Maps (API or Playwright), then attempt Facebook/Instagram (treated as unreliable extras). Dashboard enhancements (funnel analytics, bulk actions, export) are added here as operational tooling.
**Delivers:** Google Maps scraper, Facebook/Instagram scrapers (best-effort), scrape run scheduling via cron, scraper health monitoring, funnel analytics dashboard, bulk actions, CSV/JSON export
**Addresses features:** All remaining differentiators from FEATURES.md
**Avoids:** Pitfall #3 (each platform isolated, social treated as unreliable from day 1)

### Phase Ordering Rationale

- Schema-first is mandatory because `lawful_basis`, suppression list, and state machine transitions are deeply structural — adding them later requires painful migrations and temporary GDPR exposure
- OLX before other scrapers because it is the most reliable source and establishes the adapter pattern without the risk of Facebook/Instagram unreliability derailing early momentum
- Dashboard before email because manual lead review is the quality gate that protects Gmail sender reputation — automating outreach to unvetted leads is the fastest path to account ban
- Reply detection ships with email (not after) because the follow-up sequencer is unsafe without it — this is a hard dependency, not a nice-to-have
- Social media scrapers are last because they are the most fragile, require proxies, and add cost — OLX + Google Maps likely covers the majority of Polish handmade sellers

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Email Infrastructure):** Gmail OAuth2 token refresh edge cases, Gmail API polling rate limits, and bounce classification (soft vs hard) have implementation nuances worth a focused research pass
- **Phase 6 (Facebook/Instagram scrapers):** These platforms actively evolve anti-bot measures; current playwright-extra stealth effectiveness should be validated at planning time, not assumed

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Supabase schema + Next.js setup are extremely well-documented; standard patterns apply
- **Phase 2 (OLX + Scoring):** Playwright + Cheerio scraping is mature; pg-boss integration is straightforward
- **Phase 3 (Dashboard):** Next.js Server Components + Server Actions pattern is well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Library choices have clear rationale; version numbers need npm verification before use |
| Features | HIGH | Derived from analysis of mature tools in the domain (Apollo, Instantly, Lemlist, Clay); GDPR requirements are well-documented |
| Architecture | HIGH | Component boundaries and data flow are clear; schema is complete and covers all identified requirements |
| Pitfalls | HIGH | Gmail deliverability and RODO risks are well-documented and specific to the Polish market context; prevention strategies are concrete |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact Playwright version compatibility with playwright-extra stealth:** The stealth plugin has historically lagged behind Playwright releases. Verify compatibility before Phase 2 implementation.
- **Google Maps Places API cost at scale:** If the API route is chosen over scraping, pricing should be validated against expected scrape volumes before Phase 6.
- **Facebook/Instagram scraper viability:** Both platforms actively evolve anti-bot measures. Treat as high-uncertainty until Phase 6 research; do not plan timeline assumptions around them.
- **Gmail account warmup timeline:** The 2-3 week warmup required before production email volume means Phase 4 cannot start until warmup is complete. Warmup should begin in Phase 1 in parallel with schema work.
- **RODO Legitimate Interest Assessment documentation:** The LIA needs to be drafted (not just implemented technically). This is legal work, not engineering — flag for the operator to complete before Phase 4.

## Sources

### Primary (HIGH confidence)
- Playwright official docs — scraping, stealth plugin, browser context management
- Gmail API docs (googleapis) — OAuth2, thread/message polling, `In-Reply-To` header matching
- pg-boss GitHub — job queue patterns, delay/retry/cron support
- Supabase docs — PostgreSQL, Realtime, free tier limits
- UODO (Polish data protection authority) guidance — RODO Art. 6 Legitimate Interest

### Secondary (MEDIUM confidence)
- Apollo.io, Instantly, Lemlist, Clay, Woodpecker, Mailshake ecosystem analysis — feature expectations, cold email best practices
- PhantomBuster, Apify ecosystem — scraper adapter patterns
- Cold email deliverability community guidance — Gmail send limits, warmup strategies

### Tertiary (LOW confidence)
- Playwright stealth plugin current effectiveness against Facebook/Instagram — evolves rapidly, needs validation at implementation time
- Google Maps scraping fragility assessments — platform-specific, may have changed

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
