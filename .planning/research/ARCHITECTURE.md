# Architecture Research: Seed Round Pipeline

**Domain:** Lead generation / cold outreach pipeline for handmade marketplace
**Date:** 2026-04-06

## System Components

### 1. Scraper Adapters (per platform)

Each platform gets an independent scraper module with its own rate limiting, error handling, and data extraction logic.

| Platform | Method | Notes |
|----------|--------|-------|
| OLX | Playwright + stealth | Cloudflare protection, needs headless browser |
| Facebook Groups/Marketplace | Playwright + stealth | No public API, actively blocks scrapers, least reliable |
| Instagram | Playwright + stealth | No public API, aggressive anti-bot, profile-based |
| Google Maps | Places API (paid) or Playwright | API is more reliable but costs money |

**Common interface:** Each adapter implements `scrape(config) -> Lead[]` with standardized output schema.

### 2. Data Normalization & Deduplication Layer

- Validates scraped data against Zod schema
- Deduplicates on email address (primary) and phone number (secondary)
- Normalizes Polish characters, phone formats, city names
- Enriches with additional fields where available

### 3. Lead Scoring Engine

- Custom TypeScript module with weighted scoring
- Factors: post frequency, follower count, category match, price range, profile completeness, source platform reliability
- Outputs numeric score (0-100) stored in Supabase
- No ML needed at MVP — rule-based scoring

### 4. Email Sequencer

- Manages email sequences per lead (initial contact + N follow-ups)
- Configurable delays between emails (default: 3, 5, 7 days)
- Respects Gmail daily send limits (cap at 40-50/day for safety)
- Uses Nodemailer + Gmail OAuth2
- Template engine with personalization tokens ({name}, {city}, {category}, {product_type})

### 5. Reply Listener

- Polls Gmail inbox via Gmail API (googleapis)
- Matches replies by `In-Reply-To` header or thread ID
- Auto-stops follow-up sequence on reply
- Updates lead status (replied -> needs manual review)

### 6. Next.js Web Dashboard

- Server Components for lead table, analytics, email history
- Server Actions for status updates, manual overrides, scraper triggers
- Route Handlers for webhook endpoints if needed
- Real-time updates via Supabase Realtime (optional)

### 7. Supabase (System of Record)

All state lives in Supabase PostgreSQL.

## Database Schema (Proposed)

```sql
-- Core lead data
leads (
  id uuid PK,
  name text,
  email text UNIQUE,
  phone text,
  city text,
  source_platform text,        -- 'olx' | 'facebook' | 'instagram' | 'google_maps'
  source_url text,
  business_description text,
  categories text[],
  price_range text,
  social_links jsonb,          -- {facebook: url, instagram: url, ...}
  score integer,               -- 0-100
  status text,                 -- 'new' | 'scored' | 'approved' | 'contacted' | 'followed_up' | 'replied' | 'interested' | 'rejected' | 'opted_out'
  lawful_basis text,           -- GDPR: 'legitimate_interest'
  opted_out boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
)

-- Email tracking
email_events (
  id uuid PK,
  lead_id uuid FK -> leads,
  template_id uuid FK -> email_templates,
  sequence_number integer,     -- 0 = initial, 1 = first follow-up, etc.
  sent_at timestamptz,
  replied_at timestamptz,
  status text,                 -- 'sent' | 'replied' | 'bounced' | 'failed'
  gmail_message_id text,
  gmail_thread_id text
)

-- Scraping jobs
scrape_jobs (
  id uuid PK,
  platform text,
  config jsonb,                -- search terms, location, category filters
  status text,                 -- 'pending' | 'running' | 'completed' | 'failed'
  leads_found integer,
  leads_new integer,
  leads_duplicate integer,
  started_at timestamptz,
  completed_at timestamptz,
  error_log text
)

-- Email templates
email_templates (
  id uuid PK,
  name text,
  subject text,
  body text,                   -- with {tokens}
  sequence_position integer,   -- 0 = initial, 1+ = follow-ups
  is_active boolean DEFAULT true,
  created_at timestamptz
)

-- Suppression list (GDPR opt-outs)
suppression_list (
  email text PK,
  reason text,
  created_at timestamptz
)
```

## Data Flow

```
[OLX Scraper] ──┐
[FB Scraper]  ──┤
[IG Scraper]  ──┼──> Normalize & Dedupe ──> Score ──> leads table (status: 'new' -> 'scored')
[GMaps Scraper]─┘                                          │
                                                           ▼
                                              Dashboard: Review & Approve
                                                           │
                                                           ▼
                                              Email Sequencer (status: 'contacted')
                                                           │
                                                           ▼
                                              Reply Listener polls Gmail
                                                           │
                                              ┌────────────┼────────────┐
                                              ▼            ▼            ▼
                                          No reply    Reply detected  Bounce
                                          (follow-up)  (auto-stop)   (mark bad)
                                              │            │
                                              ▼            ▼
                                          Next email   Manual review
                                          in sequence   (interested/rejected)
```

## Job Execution Model

- **pg-boss** for durable job queue (backed by Supabase PostgreSQL, no Redis needed)
- Scrape jobs: triggered manually from dashboard or on cron schedule
- Email jobs: scheduled by sequencer, delayed execution for follow-ups
- Reply check: runs every 5-15 minutes via cron
- All jobs survive server restarts

## Suggested Build Order

| Order | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | Supabase schema + migrations | Nothing | Foundation for everything |
| 2 | Next.js project setup | Nothing | App shell |
| 3 | OLX scraper (first, simplest) | Schema | Proves scraping works |
| 4 | Normalize + dedupe layer | Schema | Cleans scraped data |
| 5 | Lead scoring engine | Normalized data | Prioritizes leads |
| 6 | Dashboard: lead table + management | Schema, Next.js | Visual management |
| 7 | Email sending (Nodemailer + Gmail) | Schema | Core outreach |
| 8 | Reply detection (Gmail API) | Email sending | Closes the loop |
| 9 | Follow-up sequencer | Reply detection | Automated sequences |
| 10 | Additional scrapers (FB, IG, GMaps) | OLX scraper pattern | Expand sources |

## Anti-Patterns to Avoid

- **God scraper** — one module scraping all platforms. Each platform needs its own adapter.
- **Sending without scoring** — wastes Gmail quota on low-quality leads
- **No deduplication** — same person scraped from multiple platforms gets multiple emails
- **Brute-force Gmail polling** — poll every 5-15 min, not every 30 seconds
- **Storing raw HTML** — extract data at scrape time, don't store pages (fills Supabase fast)

---
*Researched: 2026-04-06*
