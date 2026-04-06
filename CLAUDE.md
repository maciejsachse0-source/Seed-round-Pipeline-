<!-- GSD:project-start source:PROJECT.md -->
## Project

**Seed Round Pipeline**

Narzędzie do automatycznego pozyskiwania sprzedawców handmade dla marketplace'u, który jest w fazie budowy. Pipeline obejmuje cały proces: scraping kontaktów z wielu platform, analizę i scoring leadów, automatyczny cold email outreach z follow-upami, aż po zapisanie zainteresowanych sprzedawców do bazy danych. Zarządzanie odbywa się przez web dashboard.

**Core Value:** Automatyczne budowanie bazy zainteresowanych sprzedawców handmade — od znalezienia kontaktu do uzyskania zgody na współpracę.

### Constraints

- **Tech stack**: Next.js + Supabase (web dashboard + baza danych)
- **Email**: Gmail SMTP — limity wysyłki (~500/dzień na zwykłym koncie)
- **Scraping**: Musi respektować rate limits platform, unikać banów
- **RODO/GDPR**: Zbieranie danych kontaktowych wymaga uwagi na przepisy o ochronie danych
- **Budget**: Minimalne koszty — Supabase free tier na start, Gmail jako SMTP
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Scraping: Playwright + Cheerio
- **Playwright (~1.44)** for JS-heavy platforms (Facebook, Instagram, OLX dynamic pages) — handles login sessions, SPA rendering, infinite scroll. Microsoft-maintained, multi-browser, superior to Puppeteer for new projects.
- **Cheerio (~1.0)** for static HTML parsing — 10-100x faster than a headless browser when the page renders server-side. Use for OLX listing pages and Google Maps where possible.
- **playwright-extra + puppeteer-extra-plugin-stealth** for anti-fingerprint evasion on Instagram/Facebook.
### Email: Nodemailer (~6.9)
- Direct Gmail SMTP via OAuth2 (preferred) or App Passwords. Correct pairing for the project's already-decided Gmail SMTP constraint. No external service dependency, zero cost.
- For reply tracking: **googleapis (~140.x)** to poll the Gmail inbox for `In-Reply-To` header matches — simpler than setting up Pub/Sub push notifications at this scale.
### Job Queue: pg-boss (~9.x) — no Redis required
- Backed by PostgreSQL, which Supabase already provides. Durable jobs survive restarts. Supports delay, retry, cron scheduling — exactly what's needed for "send follow-up in 3 days if no reply."
- **Why not BullMQ:** Requires Redis (extra cost, extra service). Wrong for this project.
- **node-cron (~3.x)** for simple in-process cron triggers that kick off pg-boss jobs.
### HTTP Client: got (~14.x)
- ESM-native, retry, cookie jar, redirect control. Use for targets that respond to plain HTTP without a browser.
### Lead Scoring: Custom TypeScript Module
- Weighted scoring (post frequency, followers, category match, price range, profile completeness). No ML needed at MVP. Store as a numeric column in Supabase.
### Supporting Libraries
| Library | Purpose | Confidence |
|---------|---------|------------|
| zod | Schema validation of scraped data | HIGH |
| date-fns | Follow-up date math | HIGH |
| p-limit | Concurrency capping for Playwright contexts | HIGH |
| @supabase/supabase-js | Database client | HIGH |
## What NOT to Use
| Library | Reason |
|---------|--------|
| Puppeteer | Chrome-only, smaller API, slower dev cadence than Playwright |
| BullMQ | Requires Redis — unnecessary cost when pg-boss uses existing Supabase PostgreSQL |
| Selenium | Heavier, slower, Java-oriented — Playwright is the modern choice |
| SendGrid/Mailgun | Extra cost when Gmail SMTP covers the need at this scale |
## Confidence Levels
- **HIGH** for library choices (Playwright, Nodemailer, Cheerio, pg-boss rationale)
- **LOW** for specific version numbers — verify with `npm show <package> version` before use
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
