# Stack Research: Seed Round Pipeline

**Domain:** Lead generation / cold outreach pipeline for handmade marketplace
**Date:** 2026-04-06

## Recommended Stack

### Scraping: Playwright + Cheerio

- **Playwright (~1.44)** for JS-heavy platforms (Facebook, Instagram, OLX dynamic pages) — handles login sessions, SPA rendering, infinite scroll. Microsoft-maintained, multi-browser, superior to Puppeteer for new projects.
- **Cheerio (~1.0)** for static HTML parsing — 10-100x faster than a headless browser when the page renders server-side. Use for OLX listing pages and Google Maps where possible.
- **playwright-extra + puppeteer-extra-plugin-stealth** for anti-fingerprint evasion on Instagram/Facebook.

**Why not Puppeteer:** Chrome-only, smaller API surface, slower development cadence than Playwright.

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

---
*Researched: 2026-04-06*
