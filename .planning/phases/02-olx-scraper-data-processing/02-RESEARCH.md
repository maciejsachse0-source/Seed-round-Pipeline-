# Phase 2: OLX Scraper + Data Processing - Research

**Researched:** 2026-04-06
**Domain:** Web scraping (OLX.pl), data normalization (Polish locale), lead scoring, Supabase upsert deduplication
**Confidence:** MEDIUM-HIGH (page structure requires live inspection; all library choices HIGH)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRP-01 | System scrapuje listingi sprzedawców handmade z OLX (Playwright + stealth) | OLX.pl URL patterns verified; got for listing pages (static HTML); Playwright needed for phone reveal click; playwright-extra v4.3.6 + puppeteer-extra-plugin-stealth v2.11.2 confirmed compatible with Playwright 1.59.1 |
| SCRP-03 | Każdy scraper ma konfigurowalne parametry wyszukiwania (kategoria, lokalizacja, słowa kluczowe) | OLX.pl URL structure: `/antyki-i-kolekcje/rekodzielo/{city}/` + `/q-{keyword}/`; config shape defined in ScraperConfig interface |
| SCRP-04 | Scraped data jest walidowana przez Zod schema przed zapisem | zod v4.3.6 already in package.json; RawOlxLead Zod schema design documented |
| SCRP-05 | System respektuje rate limits platform (konfigurowalne opóźnienia między requestami) | OLX robots.txt has no crawl-delay; community reports 1-5 req/min threshold; p-limit v7.3.0 for concurrency; configurable delay with jitter documented |
| DATA-01 | System deduplikuje leady po adresie email (primary) i numerze telefonu (secondary) | leads.email has UNIQUE constraint in existing schema; phone needs UNIQUE index; Supabase upsert with onConflict pattern documented |
| DATA-02 | System normalizuje dane (polskie znaki, normalizes phone formats, nazwy miast) | libphonenumber-js v1.12.41 for phone E.164; city name normalization map; Polish character normalization via String.normalize('NFC') |
| DATA-03 | System filtruje business vs private sellers (liczba ogłoszeń, NIP, wskaźniki biznesowe) | business_type indicator available in OLX listing HTML; scraper signals documented |
| DATA-05 | System automatycznie scoruje leady 0-100 (aktywność, kategoria, zasięg, kompletność profilu) | Custom weighted scoring module; algorithm dimensions documented; no external library needed |
| DATA-06 | Każdy lead przechowuje pełne dane: imię, email, telefon, miasto, opis, kategorie, ceny, linki social media | leads table schema from Phase 1 covers all fields; mapping from OLX raw data documented |
</phase_requirements>

---

## Summary

Phase 2 builds the entire data acquisition pipeline: OLX.pl scraping, normalization, deduplication, and lead scoring. The Phase 1 foundation (Supabase schema, pg-boss job queue, Next.js shell) is already in place. Phase 2 adds scrapers, a normalization pipeline, and a scoring module — all triggered via pg-boss jobs.

**OLX.pl technical reality (most important finding):** OLX.pl serves listing-index pages as static HTML, making `got` (HTTP client) + Cheerio sufficient for listing discovery and data extraction. Phone numbers on OLX are partially protected: they may be obscured as image files (historical approach, older scrapers use OCR) or hidden behind a "Pokaż numer" (Show Phone) button requiring a JavaScript click. For contact data extraction, Playwright is required as a fallback for phone reveal clicks. Email addresses are NOT exposed on OLX listing pages — OLX uses in-platform messaging. This is a critical constraint: **the primary contact field for OLX leads will be phone number, not email.** Email must be treated as optional/nullable for OLX-sourced leads.

The OLX `robots.txt` explicitly permits `/api/v1/offers/` — the public OLX API. This API requires API key authentication but provides structured JSON data including listing details. Using the API is significantly more reliable than HTML scraping. The plan should offer a dual-path strategy: public API as primary (requires OLX developer account), HTML scraping as fallback.

**Primary recommendation:** Build a `ScraperAdapter` interface with an OlxScraper implementation. Use `got` for HTTP requests, Cheerio for static HTML parsing, and Playwright (with playwright-extra stealth) only for phone reveal clicks. Dispatch all scrape work via pg-boss jobs already initialized in Phase 1. Store raw extracted data in the `scrape_jobs.config` JSONB, process it through a normalization pipeline, and upsert to the leads table with ON CONFLICT handling.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Detail |
|------------|--------|
| Tech stack | Next.js + Supabase — no alternatives |
| Scraping tools | Playwright + Cheerio (locked) — playwright-extra + puppeteer-extra-plugin-stealth for anti-fingerprint |
| HTTP client | got (~14.x) for plain HTTP requests |
| Concurrency cap | p-limit for Playwright contexts |
| Validation | zod for all scraped data before DB write |
| Rate limiting | Must respect platform limits — configurable delays required |
| RODO/GDPR | Collected contact data falls under GDPR — lawful_basis field required (already in schema from Phase 1) |
| Job queue | pg-boss (already initialized in Phase 1) — no new queue infrastructure |
| Budget | No paid APIs or external services unless zero-cost |
| Workflow | All file changes via GSD workflow |

---

## Standard Stack

### Core (new packages for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| got | 15.0.0 | ESM HTTP client for OLX listing page requests | Locked by CLAUDE.md; ESM-native, built-in retry, cookie jar |
| cheerio | 1.2.0 | Static HTML parsing of OLX listing index pages | Locked by CLAUDE.md; jQuery-like API, 10-100x faster than Playwright for static pages |
| playwright | 1.59.1 | Headless browser for phone reveal button clicks | Locked by CLAUDE.md; needed for JS-gated phone reveal on OLX |
| playwright-extra | 4.3.6 | Plugin system wrapping Playwright with stealth plugins | Locked by CLAUDE.md; peer dependency accepts any Playwright version (`playwright: '*'`) |
| puppeteer-extra-plugin-stealth | 2.11.2 | Anti-fingerprint evasion (masks headless indicators) | Locked by CLAUDE.md; works with playwright-extra to avoid bot detection |
| p-limit | 7.3.0 | Concurrency cap for parallel Playwright browser contexts | Locked by CLAUDE.md; prevents resource exhaustion from concurrent browsers |
| libphonenumber-js | 1.12.41 | Polish phone number normalization to E.164 format | Google's libphonenumber algorithm; handles all Polish number formats (landline, mobile, +48, 0048, local) |

### Already in package.json (from Phase 1)

| Library | Version | Purpose |
|---------|---------|---------|
| zod | 4.3.6 | Scraped data validation before DB write |
| @supabase/supabase-js | 2.101.1 | Database upsert with ON CONFLICT |
| pg-boss | 12.15.0 | Job queue — scrape jobs dispatched here |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| got + Cheerio | axios + cheerio | got is ESM-native, already locked in CLAUDE.md; axios needs CommonJS shim |
| libphonenumber-js | phone (npm) | Both handle Polish numbers; libphonenumber-js is the Google algorithm — more maintained, more country coverage |
| Custom scoring | External ML service | No ML needed at MVP — weighted scoring is sufficient and zero-cost |
| HTML scraping | OLX public API | API requires developer account + API key (setup overhead); HTML scraping needs no registration; dual-path recommended |

**Installation (new packages only):**
```bash
npm install got cheerio playwright playwright-extra puppeteer-extra-plugin-stealth p-limit libphonenumber-js
npx playwright install chromium
```

**Version verification:** All versions confirmed via `npm view <package> version` on 2026-04-06. [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── scrapers/
│   ├── types.ts               # ScraperAdapter interface, ScraperConfig, RawLead types
│   ├── olx/
│   │   ├── olx-scraper.ts     # Main OlxScraper class implementing ScraperAdapter
│   │   ├── olx-parser.ts      # Cheerio HTML parsing functions (pure functions)
│   │   ├── olx-urls.ts        # URL construction for category + location + keyword
│   │   └── olx-phone.ts       # Playwright phone reveal logic (isolated)
│   └── index.ts               # Export registry for available scrapers
├── pipeline/
│   ├── normalize.ts           # Polish data normalization (phone, city, chars)
│   ├── deduplicate.ts         # Supabase upsert with ON CONFLICT logic
│   ├── score.ts               # Lead scoring module (0-100)
│   └── ingest.ts              # Orchestrates: raw → normalize → deduplicate → score → save
└── queue/
    └── workers/
        └── scrape-worker.ts   # pg-boss worker for 'scrape-olx' job

app/
└── api/
    └── scrape/
        └── route.ts           # Route Handler to dispatch scrape job via pg-boss
```

### Pattern 1: ScraperAdapter Interface

**What:** All scrapers implement a common interface. OlxScraper is Phase 2's only implementation. Allows Phase 6 (Google Maps) to add a second scraper without touching the pipeline.
**When to use:** Every scraper must conform to this contract.

```typescript
// lib/scrapers/types.ts
export interface ScraperConfig {
  categories: string[]       // e.g. ['antyki-i-kolekcje/rekodzielo', 'dom-ogrod/wyposazenie-wnetrz/dekoracje']
  cities: string[]           // e.g. ['warszawa', 'krakow', ''] — empty string = all Poland
  keywords: string[]         // e.g. ['handmade', 'rekodzielniczy'] — appended as /q-{keyword}/
  maxPages: number           // page limit per category+city combination
  delayMs: number            // base delay between requests in ms (default 3000)
  jitterMs: number           // random jitter added to delay (default 1000)
  concurrency: number        // max parallel Playwright contexts (default 1)
}

export interface RawLead {
  sourceUrl: string
  sourcePlatform: 'olx'
  name: string | null
  phone: string | null
  email: string | null          // OLX: almost always null — in-platform messaging only
  city: string | null
  description: string | null
  categories: string[]
  priceMin: number | null
  priceMax: number | null
  socialLinks: Record<string, string>
  sellerType: 'private' | 'business' | 'unknown'
  listingCount: number | null   // number of active listings — activity signal
  scrapedAt: string             // ISO timestamp
}
```

### Pattern 2: OLX URL Construction

**What:** OLX.pl uses clean path-based URLs for category + location + keyword. No complex query parameters. [VERIFIED: olx.pl robots.txt fetch + URL observation]

```typescript
// lib/scrapers/olx/olx-urls.ts
// Source: observed OLX.pl URL patterns
const BASE = 'https://www.olx.pl'

export function buildListingUrl(
  category: string,   // e.g. 'antyki-i-kolekcje/rekodzielo'
  city: string,       // e.g. 'warszawa' or '' for all Poland
  keyword: string,    // e.g. 'handmade' or ''
  page: number        // 1-based
): string {
  // Pattern: /category/city/q-keyword/?page=N
  let url = `${BASE}/${category}/`
  if (city) url += `${city}/`
  if (keyword) url += `q-${encodeURIComponent(keyword)}/`
  if (page > 1) url += `?page=${page}`
  return url
}

// Handmade-relevant OLX categories
export const HANDMADE_CATEGORIES = [
  'antyki-i-kolekcje/rekodzielo',           // Primary: crafts & handmade
  'dom-ogrod/wyposazenie-wnetrz/dekoracje', // Decorations (many handmade)
  'moda/ubrania',                            // Clothing (handmade apparel)
  'moda/bizuteria-i-akcesoria',             // Jewelry (handmade jewelry common)
] as const
```

### Pattern 3: got HTTP Request with Rate Limiting

**What:** Use `got` for all OLX index/listing page requests. Set realistic headers. Wrap with configurable delay + jitter. [VERIFIED: npm registry for got v15; community guidance on OLX headers]

```typescript
// lib/scrapers/olx/olx-scraper.ts
import got from 'got'

const client = got.extend({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  },
  retry: { limit: 2, statusCodes: [429, 503] },
  timeout: { request: 15000 },
})

async function delayWithJitter(baseMs: number, jitterMs: number): Promise<void> {
  const delay = baseMs + Math.random() * jitterMs
  await new Promise(resolve => setTimeout(resolve, delay))
}
```

### Pattern 4: Phone Reveal via Playwright (Stealth)

**What:** OLX hides phone numbers behind a "Pokaż numer telefonu" button. Clicking it triggers a JavaScript action that reveals the phone. Requires Playwright since `got` cannot execute JS. [ASSUMED based on historical OLX behavior — must verify against live page during Wave 0]

```typescript
// lib/scrapers/olx/olx-phone.ts
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

chromium.use(StealthPlugin())

export async function revealPhone(listingUrl: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })

    // Look for phone reveal button — selector needs live inspection to confirm
    const phoneBtn = page.locator('[data-testid="show-phone"], button:has-text("Pokaż numer"), [class*="show-phone"]')
    if (await phoneBtn.count() > 0) {
      await phoneBtn.first().click()
      await page.waitForTimeout(1500)  // wait for reveal animation/API response
      // Phone may appear in text near the button — selector TBD from live inspection
      const phoneText = await page.locator('[data-testid="phone-number"], [class*="phone-number"]').textContent()
      return phoneText?.trim() ?? null
    }
    return null
  } finally {
    await browser.close()
  }
}
```

**CRITICAL NOTE:** Phone reveal selector (`[data-testid="show-phone"]` etc.) is `[ASSUMED]` — must be confirmed via live OLX.pl inspection during Wave 0. The selector may have changed since any available reference was written.

### Pattern 5: Zod Schema for Raw Lead Validation

**What:** All scraped data passes through a Zod schema before entering the normalization pipeline. Rejects structurally invalid data early. [VERIFIED: zod v4.3.6 in package.json]

```typescript
// lib/scrapers/types.ts
import { z } from 'zod'

export const RawLeadSchema = z.object({
  sourceUrl: z.string().url(),
  sourcePlatform: z.literal('olx'),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  city: z.string().nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  socialLinks: z.record(z.string()),
  sellerType: z.enum(['private', 'business', 'unknown']),
  listingCount: z.number().int().nonnegative().nullable(),
  scrapedAt: z.string().datetime(),
})

export type RawLead = z.infer<typeof RawLeadSchema>
```

### Pattern 6: Normalization Pipeline

**What:** Three normalization steps applied in sequence before DB write. [VERIFIED: libphonenumber-js npm entry]

```typescript
// lib/pipeline/normalize.ts
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'

// Polish phone normalization to E.164
export function normalizePolishPhone(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s+/g, '').replace(/[()-]/g, '')
  try {
    const parsed = parsePhoneNumber(cleaned, 'PL')  // default country: Poland
    return parsed.isValid() ? parsed.format('E.164') : null  // e.g. '+48501234567'
  } catch {
    return null
  }
}

// City name normalization — canonical form for Polish cities
const CITY_ALIASES: Record<string, string> = {
  'warszawa': 'Warszawa', 'warsaw': 'Warszawa',
  'krakow': 'Kraków', 'cracow': 'Kraków', 'kraków': 'Kraków',
  'wroclaw': 'Wrocław', 'wrocław': 'Wrocław',
  'poznan': 'Poznań', 'poznan': 'Poznań',
  'gdansk': 'Gdańsk', 'gdańsk': 'Gdańsk',
  'lodz': 'Łódź', 'łódź': 'Łódź',
  // ... extend as needed
}

export function normalizeCity(raw: string | null): string | null {
  if (!raw) return null
  const key = raw.toLowerCase().trim().normalize('NFC')
  return CITY_ALIASES[key] ?? raw.trim()
}

// Polish character normalization — NFC is canonical form
export function normalizePolishText(raw: string | null): string | null {
  if (!raw) return null
  return raw.normalize('NFC').trim()
}
```

### Pattern 7: Deduplication via Supabase Upsert

**What:** The leads table has `email UNIQUE` from Phase 1. Phone needs a unique index too (for secondary deduplication). Use `upsert` with `onConflict: 'email'` as primary strategy; check phone separately.

**Migration needed in Phase 2:** Add `UNIQUE` constraint on `phone` (nullable columns need special handling — two nulls don't conflict in Postgres UNIQUE constraints, so phone NULLs are safe).

```typescript
// lib/pipeline/deduplicate.ts — Source: Supabase upsert docs
import { createClient } from '@/lib/supabase/server'

export async function upsertLead(lead: NormalizedLead): Promise<'created' | 'duplicate'> {
  const supabase = await createClient()

  // Primary dedup: email unique constraint
  if (lead.email) {
    const { error } = await supabase
      .from('leads')
      .upsert(lead, { onConflict: 'email', ignoreDuplicates: true })
    if (error) throw error
    return /* check count */ 'created'
  }

  // Secondary dedup: phone (when no email)
  if (lead.phone) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', lead.phone)
      .single()
    if (existing) return 'duplicate'
  }

  const { error } = await supabase.from('leads').insert(lead)
  if (error) throw error
  return 'created'
}
```

**IMPORTANT:** The current `leads` schema has `email UNIQUE NOT NULL`. For OLX leads (where email is typically null), the constraint must be loosened to `email UNIQUE NULL` (or removed and replaced with a partial unique index). This requires a new migration. [ASSUMED: current constraint will block phone-only OLX inserts — verify against live schema]

### Pattern 8: Lead Scoring Module

**What:** Weighted numeric score (0-100) stored in `leads.score`. No ML. Pure TypeScript function. [ASSUMED — scoring dimensions and weights based on project goals; operator can tune weights]

```typescript
// lib/pipeline/score.ts
export interface ScoringSignals {
  hasEmail: boolean           // 0 or 1
  hasPhone: boolean           // 0 or 1
  hasSocialLinks: boolean     // 0 or 1
  hasDescription: boolean     // 0 or 1
  hasPriceRange: boolean      // 0 or 1
  listingCount: number        // activity proxy — more listings = more active seller
  categoryMatch: number       // 0.0 to 1.0 — how well category matches target
  sellerType: 'business' | 'private' | 'unknown'
}

const WEIGHTS = {
  contactCompleteness: 30,  // phone+email completeness (most important — can we reach them)
  profileCompleteness: 25,  // description, social links, price range
  activity: 25,             // listing count proxy
  categoryMatch: 15,        // category relevance
  sellerType: 5,            // business sellers slightly prefer (established)
}

export function scoreLead(signals: ScoringSignals): number {
  let score = 0

  // Contact completeness (max 30)
  score += signals.hasPhone ? 20 : 0
  score += signals.hasEmail ? 10 : 0

  // Profile completeness (max 25)
  score += signals.hasDescription ? 10 : 0
  score += signals.hasSocialLinks ? 8 : 0
  score += signals.hasPriceRange ? 7 : 0

  // Activity: listing count (max 25) — cap at 10 listings for max score
  const activityScore = Math.min(signals.listingCount ?? 0, 10) / 10 * 25
  score += activityScore

  // Category match (max 15)
  score += Math.round(signals.categoryMatch * 15)

  // Seller type (max 5)
  score += signals.sellerType === 'business' ? 5 : signals.sellerType === 'private' ? 3 : 0

  return Math.min(100, Math.round(score))
}
```

### Pattern 9: pg-boss Worker Dispatch

**What:** A Server Action or Route Handler dispatches a 'scrape-olx' job. The worker (started in `instrumentation.ts`) processes it. Follows pg-boss patterns from Phase 1.

```typescript
// lib/queue/workers/scrape-worker.ts
import { getBoss } from '@/lib/queue/boss'
import { OlxScraper } from '@/lib/scrapers/olx/olx-scraper'
import { ingestRawLeads } from '@/lib/pipeline/ingest'

export async function registerScrapeWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.work('scrape-olx', async ([job]) => {
    const config = job.data as ScraperConfig
    const scraper = new OlxScraper(config)
    const rawLeads = await scraper.run()
    const result = await ingestRawLeads(rawLeads, job.id)
    console.log(`[scrape-olx] job ${job.id}: ${result.created} new, ${result.duplicate} dupes`)
  })
}
```

### Anti-Patterns to Avoid

- **Treating email as required for OLX leads:** OLX does not expose seller emails. The `leads.email UNIQUE NOT NULL` constraint from Phase 1 must be changed to nullable for this phase. Do not reject leads that have phone but no email.
- **Using Playwright for every page request:** Playwright is expensive (full browser context). Use `got` + Cheerio for listing index pages; only spawn Playwright for individual phone-reveal operations. Use `p-limit(1)` to prevent concurrent browser contexts.
- **Hardcoding CSS selectors in the scraper:** OLX changes their markup. Extract all selectors into a constants file (`olx-selectors.ts`) so updates are a single-file change.
- **Not updating `scrape_jobs` table during execution:** The `scrape_jobs` table tracks status, leads_found, leads_new, leads_duplicate. Update it throughout the job lifecycle — not just at the end. Failure mid-job needs a partial record.
- **Ignoring the phone-is-null scenario in scoring:** Many OLX private sellers may not reveal their phone number. A lead with no phone AND no email should still be recorded (score will be low) rather than discarded — the operator can decide.
- **Opening a new Playwright browser per listing:** Reuse one browser across multiple page visits. Open a new context per visit, but keep the browser instance alive for the duration of the scrape job.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone number normalization | Custom regex for Polish numbers | `libphonenumber-js` | Polish numbers have multiple valid formats (+48, 0048, 48, local 9-digit). Custom regex will miss edge cases. Google's algorithm handles all of them. |
| Concurrency limiting | `Promise.all()` with arbitrary parallelism | `p-limit` | Unbounded concurrent Playwright browsers will OOM the server. p-limit is 100 lines you don't need to write. |
| HTML parsing | RegExp on raw HTML | `cheerio` | RegExp on HTML is fragile; Cheerio handles malformed HTML, nested selectors, and attribute queries correctly. |
| Retry logic | Manual try/catch retry loops | `got` built-in retry | got has exponential backoff, status-code-based retry, and timeout handling built in. |
| Browser stealth | Manual header spoofing | `playwright-extra` + `puppeteer-extra-plugin-stealth` | Stealth plugin patches 15+ Chromium fingerprint leak points (webdriver flag, plugins array, navigator properties). Manual fixes miss most of them. |
| UUID-based dedup | Check-then-insert pattern | Supabase `upsert` with `onConflict` | Postgres ON CONFLICT is atomic; check-then-insert has a race condition. |

**Key insight:** Phone normalization is the single biggest hand-roll trap. Polish phone numbers appear as: `501 234 567`, `+48 501 234 567`, `0048501234567`, `(22) 123-45-67` (Warsaw landline), `22 123 45 67`. A regex that covers one misses others. Use libphonenumber-js.

---

## OLX.pl Technical Reality (Critical Findings)

### Contact Data Availability

| Field | OLX Availability | Collection Method |
|-------|-----------------|-------------------|
| Seller name | Yes — visible in HTML | Cheerio parse |
| Phone | Partially hidden | Click "Pokaż numer" button → Playwright |
| Email | NOT available | OLX uses in-platform messaging — email not exposed |
| City | Yes — visible in HTML | Cheerio parse |
| Description | Yes — visible in HTML | Cheerio parse |
| Categories | Yes — in URL + breadcrumb | URL parse + Cheerio |
| Price | Yes — visible in HTML | Cheerio parse |
| Social links | Rare — some sellers include in description | Regex extraction from description text |
| Listing count | Yes — on seller profile page | Separate got request to seller profile |

### URL Structure [VERIFIED: olx.pl robots.txt + URL observation]

```
Category listing:    https://www.olx.pl/{category}/
With city:           https://www.olx.pl/{category}/{city}/
With keyword:        https://www.olx.pl/{category}/{city}/q-{keyword}/
Pagination:          https://www.olx.pl/{category}/{city}/q-{keyword}/?page=2
Individual listing:  https://www.olx.pl/d/oferta/{slug}.html
Seller profile:      https://www.olx.pl/uzytkownik/{seller-id}/
```

### Robots.txt Permission [VERIFIED: live robots.txt fetch 2026-04-06]

OLX robots.txt (`User-agent: *`) explicitly **allows**:
- `/api/v1/offers/` — public API endpoint for listing data

OLX robots.txt **disallows**:
- `/api/` (general) with exceptions above
- `/oferta/kontakt/` — contact forms
- `*/ajax/` — AJAX endpoints
- `*/konto/`, `*/mojolx/` — user account areas

**Implication:** Scraping the HTML listing pages (`/antyki-i-kolekcje/rekodzielo/`) is not explicitly disallowed. The `/api/v1/offers/` endpoint is explicitly permitted and provides structured JSON — preferred over HTML parsing when API key is available.

### Rate Limiting Reality

- No crawl-delay in robots.txt [VERIFIED]
- Community reports: 1-5 requests/minute triggers throttling [MEDIUM confidence — multiple sources converge]
- Safe strategy: 3-5 second base delay + 0-2 second random jitter between requests
- Response codes to handle: 429 (rate limited) → back off 60s; 403 (blocked) → stop job, flag error

---

## Schema Migration Required

The Phase 1 schema has `email UNIQUE NOT NULL` on the leads table. OLX does not expose seller email addresses. This must be changed in a Phase 2 migration:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_olx_nullable_email.sql
-- Allow null email for OLX-sourced leads (OLX uses in-platform messaging)
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;
-- Keep unique constraint but allow multiple NULLs (Postgres allows this by default)

-- Add phone unique index (conditional — only unique when non-null)
CREATE UNIQUE INDEX idx_leads_phone_unique ON leads (phone) WHERE phone IS NOT NULL;

-- Add source_url unique index to prevent re-scraping same listing
CREATE UNIQUE INDEX idx_leads_source_url ON leads (source_url) WHERE source_url IS NOT NULL;
```

**CRITICAL:** Without this migration, all OLX inserts will fail with `not null constraint` on email. This is the first task of Phase 2 Wave 0.

---

## Common Pitfalls

### Pitfall 1: Email is NULL for All OLX Leads

**What goes wrong:** Developer assumes OLX exposes seller email. It doesn't. OLX uses in-platform messaging. Scraper gets null email, DB constraint fires, all leads fail to insert.
**Why it happens:** The leads table was designed before OLX reality was verified; email was `NOT NULL`.
**How to avoid:** Migration first (see Schema Migration Required above). Accept null emails for OLX. Only score them lower (no email = -10 points in scoring).
**Warning signs:** All scrape job inserts fail with `null value in column "email" of relation "leads" violates not-null constraint`.

### Pitfall 2: Phone Reveal Button Selector Changes

**What goes wrong:** Playwright tries to click `[data-testid="show-phone"]` but OLX changed the button's HTML. The phone reveal step silently returns null for every listing.
**Why it happens:** OLX is a live SPA — their markup changes without notice.
**How to avoid:** (1) Isolate phone reveal into `olx-phone.ts` with all selectors in a constants object at the top. (2) Add a dead-letter log when phone reveal returns null on a listing that visually has a phone button. (3) Wave 0 task: inspect a live OLX listing to confirm current selector.
**Warning signs:** 0% phone capture rate on listings that should have phone numbers.

### Pitfall 3: Playwright Browser Context Leak

**What goes wrong:** A Playwright browser is opened per listing but not closed on error. After 50 listings, 50 Chromium processes are running. Server OOMs.
**Why it happens:** `browser.close()` is in a `finally` block but the outer function throws before reaching it.
**How to avoid:** Always use `try/finally` in `revealPhone()`. Use `p-limit(1)` to guarantee only one browser exists at a time. Log browser count in dev.
**Warning signs:** Memory usage climbing steadily during a scrape job; Node.js heap exceeded errors.

### Pitfall 4: Polish Character Encoding Corruption

**What goes wrong:** City name "Łódź" becomes "ŁódÅ¼" after HTTP response parsing. Normalization fails to match canonical forms.
**Why it happens:** OLX sends UTF-8 but got/Cheerio need explicit encoding handling; `got` defaults to detecting encoding from headers but edge cases exist.
**How to avoid:** Explicitly set `responseType: 'text'` and verify charset from Content-Type header. Apply `String.normalize('NFC')` to all string fields after extraction. [ASSUMED: got v15 handles this automatically in most cases — verify with a test against live OLX page]
**Warning signs:** City names or descriptions contain garbled multi-byte sequences; normalization map lookups fail for known cities.

### Pitfall 5: Duplicate Scraping of Already-Processed Listings

**What goes wrong:** Running the scraper twice for the same category/city scrapes the same listings, fails on DB unique constraints (or silently ignores via ON CONFLICT), and wastes rate-limit budget.
**Why it happens:** Scraper has no memory of previous runs.
**How to avoid:** Track `source_url` in the leads table (unique index from migration). Use `upsert` with `onConflict: 'source_url'` + `ignoreDuplicates: true` as the first dedup check. Log `leads_duplicate` count in `scrape_jobs` table for operator visibility.
**Warning signs:** `leads_duplicate` count equals `leads_found` count — all leads were already in the database.

### Pitfall 6: pg-boss Worker Not Registered at Startup

**What goes wrong:** A scrape job is dispatched via Server Action and appears in pg-boss queue but the worker never picks it up. The job sits in `state: created` forever.
**Why it happens:** `registerScrapeWorker()` was never called in `instrumentation.ts`. Workers must be registered at server startup.
**How to avoid:** Add `registerScrapeWorker()` call inside the `if (process.env.NEXT_RUNTIME === 'nodejs')` block in `instrumentation.ts`. Verify with a test dispatch after restart.
**Warning signs:** pg-boss `scrape-olx` job stays in `created` state indefinitely; no worker console output.

---

## Code Examples

### pg-boss Job Dispatch (Server Action)

```typescript
// app/api/scrape/route.ts — Route Handler to trigger scrape
// Source: pg-boss v12 API patterns from Phase 1 research
import { getBoss } from '@/lib/queue/boss'
import { NextResponse } from 'next/server'
import type { ScraperConfig } from '@/lib/scrapers/types'

export async function POST(request: Request) {
  const config: ScraperConfig = await request.json()
  const boss = await getBoss()
  const jobId = await boss.send('scrape-olx', config)
  return NextResponse.json({ jobId })
}
```

### Supabase Upsert with Conflict Resolution

```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
const { error } = await supabase
  .from('leads')
  .upsert(
    { ...leadData, source_url: 'https://www.olx.pl/d/oferta/...' },
    { onConflict: 'source_url', ignoreDuplicates: true }
  )
```

### OLX Category + Location Listing URLs

```
// Handmade crafts, all Poland:
https://www.olx.pl/antyki-i-kolekcje/rekodzielo/

// Handmade crafts, Warsaw only:
https://www.olx.pl/antyki-i-kolekcje/rekodzielo/warszawa/

// Home decor handmade, Kraków, keyword 'handmade':
https://www.olx.pl/dom-ogrod/wyposazenie-wnetrz/dekoracje/krakow/q-handmade/

// Page 2:
https://www.olx.pl/antyki-i-kolekcje/rekodzielo/q-handmade/?page=2
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for browser automation | Playwright 1.59.1 | 2022+ | Playwright is multi-browser, better maintained, CLAUDE.md locked |
| Phone image (GIF) + OCR | Click "Pokaż numer" button (JS-rendered text) | ~2019-2021 | OCR is fragile; modern OLX reveals phone as text after a button click |
| `axios` + `cheerio` | `got` + `cheerio` | Project decision | got is ESM-native; axios needs shim in ESM environments |
| `phone` npm package | `libphonenumber-js` | Ongoing | Both current; libphonenumber-js is the Google algorithm reference implementation |

**Deprecated/outdated:**
- OLX phone-as-GIF-image scraping: Modern OLX (2021+) reveals phone as text via a button click. The OCR approach is obsolete. [MEDIUM confidence — older scrapers describe GIF; newer reports describe button click revealing text]
- `puppeteer-extra-plugin-stealth` with Puppeteer directly: Use with `playwright-extra` wrapper instead, as Playwright is the project's locked choice.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phone reveal on OLX.pl requires a "Pokaż numer" button click via Playwright (not in static HTML) | Pattern 4, Pitfall 2 | If phone is in static HTML, Playwright is unnecessary for this step — simpler Cheerio parse suffices |
| A2 | `[data-testid="show-phone"]` is the current phone reveal button selector | Pattern 4 | Wrong selector = 0% phone capture rate; must verify against live page in Wave 0 |
| A3 | Email addresses are not exposed on OLX.pl listing pages | OLX Technical Reality | If OLX does expose email in some cases (e.g. business listings), scoring needs adjustment |
| A4 | `leads.email NOT NULL` in current schema will block phone-only inserts | Schema Migration Required | If constraint was already relaxed (Phase 1 Plan 04), migration is a no-op but still safe to run |
| A5 | Scoring weights (contact 30%, completeness 25%, activity 25%, category 15%, seller type 5%) are appropriate | Pattern 8 | Operator may find different weights produce better-quality leads; weights should be tunable constants |
| A6 | got v15 handles UTF-8 Polish character encoding correctly without explicit charset override | Pitfall 4 | If encoding is wrong, Polish city/name fields will have garbled characters requiring post-processing |
| A7 | OLX listing index pages are static HTML (not JS-rendered SPA) | Standard Stack, Pattern 3 | If OLX has migrated to client-side rendering, got + Cheerio will get empty pages; must use Playwright for all page fetches |

---

## Open Questions

1. **Is the phone reveal button still JavaScript-gated or is phone now in static HTML?**
   - What we know: Historical scrapers describe GIF-encoded phone (pre-2021); newer reports describe a reveal button
   - What's unclear: Current (2026) behavior — button click vs. static HTML vs. API call
   - Recommendation: Wave 0 task — open a live OLX.pl listing in browser devtools, inspect whether phone number is in the HTML source or loaded via XHR after button click. This determines whether got/Cheerio suffices or Playwright is needed.

2. **OLX Public API vs. HTML Scraping: Which to use?**
   - What we know: `robots.txt` allows `/api/v1/offers/`; the API exists and has unofficial wrappers; authentication (API key) required
   - What's unclear: Ease of getting OLX developer account + API key; whether API exposes phone/contact data; rate limits on the API
   - Recommendation: Build HTML scraping path first (no account required). Leave a `// TODO: implement OLX API path` stub in `olx-scraper.ts` with the `ScraperAdapter` interface. The API path can be added later.

3. **Does `leads.email NOT NULL` constraint exist in the live Supabase DB?**
   - What we know: Phase 1 Plan 01 migration included `email text UNIQUE NOT NULL`
   - What's unclear: Whether Plan 04 (live DB push) was executed before Phase 2 starts
   - Recommendation: Wave 0 — run `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'email'` against the live Supabase instance. If NOT NULLABLE, the schema migration is blocking and must be the first task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | playwright (requires modern Node) | Yes | v22.22.0 | — |
| Chromium (via Playwright) | Phone reveal button clicks | Not yet | — | `npx playwright install chromium` in Wave 0 |
| got | HTTP requests to OLX | Not yet installed | 15.0.0 | — |
| cheerio | HTML parsing | Not yet installed | 1.2.0 | — |
| playwright-extra | Stealth browser automation | Not yet installed | 4.3.6 | — |
| puppeteer-extra-plugin-stealth | Anti-fingerprint | Not yet installed | 2.11.2 | — |
| p-limit | Concurrency cap | Not yet installed | 7.3.0 | — |
| libphonenumber-js | Phone normalization | Not yet installed | 1.12.41 | — |
| Supabase remote DB | Lead storage | Yes (configured in Phase 1) | — | — |
| OLX developer API key | API-based scraping | Not available | — | HTML scraping path (fallback — use this) |

**Missing dependencies with no fallback:**
- Chromium browser binary: Must be installed via `npx playwright install chromium` before any browser-based phone reveal works.

**Missing dependencies with fallback:**
- OLX API key: Use HTML scraping path instead (no registration required, less structured but functional).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (exists from Phase 1) |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-03 | `buildListingUrl()` constructs correct OLX URLs for category + city + keyword + page | unit | `npx vitest run tests/olx-urls.test.ts` | Wave 0 gap |
| SCRP-04 | `RawLeadSchema.parse()` rejects invalid scraped data | unit | `npx vitest run tests/scraper-validation.test.ts` | Wave 0 gap |
| SCRP-05 | `delayWithJitter(3000, 1000)` returns value in [3000, 4000] range | unit | `npx vitest run tests/scraper-rate-limit.test.ts` | Wave 0 gap |
| DATA-01 | Inserting same email twice returns 'duplicate' not DB error | integration | `npx vitest run tests/deduplicate.test.ts` | Wave 0 gap |
| DATA-01 | Inserting same phone twice (no email) returns 'duplicate' | integration | `npx vitest run tests/deduplicate.test.ts` | Wave 0 gap |
| DATA-02 | `normalizePolishPhone('+48 501 234 567')` → `'+48501234567'` | unit | `npx vitest run tests/normalize.test.ts` | Wave 0 gap |
| DATA-02 | `normalizePolishPhone('501234567')` → `'+48501234567'` | unit | `npx vitest run tests/normalize.test.ts` | Wave 0 gap |
| DATA-02 | `normalizeCity('krakow')` → `'Kraków'` | unit | `npx vitest run tests/normalize.test.ts` | Wave 0 gap |
| DATA-03 | Business listings have `sellerType: 'business'` in parsed raw lead | unit | `npx vitest run tests/olx-parser.test.ts` | Wave 0 gap |
| DATA-05 | `scoreLead({ hasPhone: true, hasEmail: true, ... })` returns score in [0, 100] | unit | `npx vitest run tests/score.test.ts` | Wave 0 gap |
| DATA-05 | Lead with all fields populated scores > lead with no fields | unit | `npx vitest run tests/score.test.ts` | Wave 0 gap |
| DATA-06 | Normalized lead has all 9 required fields in DB record | integration | `npx vitest run tests/ingest.test.ts` | Wave 0 gap |
| SCRP-01 | OLX HTML page fetch returns listing URLs (smoke test with real HTTP call) | smoke/manual | Manual — requires live OLX access | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/normalize.test.ts tests/score.test.ts tests/olx-urls.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/normalize.test.ts` — covers DATA-02 (phone + city normalization)
- [ ] `tests/score.test.ts` — covers DATA-05 (scoring algorithm)
- [ ] `tests/olx-urls.test.ts` — covers SCRP-03 (URL construction)
- [ ] `tests/deduplicate.test.ts` — covers DATA-01 (upsert dedup logic)
- [ ] `tests/scraper-validation.test.ts` — covers SCRP-04 (Zod schema)
- [ ] `tests/olx-parser.test.ts` — covers DATA-03 (business vs private detection)
- [ ] `tests/ingest.test.ts` — covers DATA-06 (full field mapping)
- [ ] Install scraping libraries: `npm install got cheerio playwright playwright-extra puppeteer-extra-plugin-stealth p-limit libphonenumber-js`
- [ ] Install Chromium: `npx playwright install chromium`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user-facing auth in Phase 2 |
| V3 Session Management | No | Scraper sessions are stateless HTTP |
| V4 Access Control | No | Single-user tool |
| V5 Input Validation | Yes | zod validates all scraped data before DB write; never trust raw HTML values |
| V6 Cryptography | No | No crypto in Phase 2 |
| V14 Configuration | Yes | Rate limit config in code, not .env; scraper config passed as job data through pg-boss (not URL params) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious HTML in scraped description field | Tampering | Store raw text; sanitize at display time in Phase 3 (not at scrape time — sanitization at storage can lose data) |
| Phone number injection (scraped value contains SQL) | Tampering | Parameterized Supabase queries; libphonenumber-js rejects non-numeric values |
| Selenium/bot detection triggering IP block | Denial of Service | playwright-extra stealth; configurable rate limit delays; stop-on-403 logic |
| GDPR: scraping personal data without basis | Information Disclosure | lawful_basis = 'legitimate_interest' already in schema (Phase 1); notify leads in cold email of data collection (Phase 4) |

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <package> version`) — all version numbers verified 2026-04-06 [VERIFIED]
- `https://www.olx.pl/robots.txt` — URL structure permissions, allowed API paths [VERIFIED: live fetch 2026-04-06]
- `https://github.com/Pawikoski/olx-api-wrapper` — OLX public API structure, unauthenticated endpoints [VERIFIED: WebFetch]
- `https://supabase.com/docs/reference/javascript/upsert` — Supabase upsert + onConflict patterns [CITED]
- `https://playwright.dev/docs/input` — Playwright click/interaction patterns [CITED]

### Secondary (MEDIUM confidence)
- `https://scraperly.com/scrape/olx` — OLX.pl static HTML + rate limiting behavior [WebFetch verified]
- `https://www.falconscrape.com/blog/how-to-scrape-olx-listings` — OLX.pl data field availability [WebFetch]
- `https://github.com/rodolfoghi/olx-phone-loader` — Historical phone-as-GIF mechanism (now obsolete) [WebFetch]
- WebSearch results: playwright-extra + puppeteer-extra-plugin-stealth compatibility with Playwright 1.50+ [Multiple sources converge — MEDIUM]
- npm `libphonenumber-js` page — Polish phone normalization algorithm [WebFetch]

### Tertiary (LOW confidence)
- Training knowledge on OLX.pl UI behavior (phone reveal button mechanism) — marked [ASSUMED A1, A2]
- Community rate limit reports (1-5 req/min) — multiple forum/blog posts, no official OLX documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack (libraries, versions): HIGH — all verified via npm registry
- OLX URL structure: HIGH — verified via robots.txt and live URL observation
- OLX phone reveal mechanism: LOW — [ASSUMED]; must verify against live page in Wave 0
- OLX contact data availability: MEDIUM — consistent across multiple scraping guides
- Normalization patterns: HIGH — libphonenumber-js is well-documented
- Scoring algorithm: MEDIUM — weights are [ASSUMED] reasonable defaults, operator-tunable
- Schema migration requirement: HIGH — `email NOT NULL` in Phase 1 schema will definitively block OLX inserts

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (OLX markup can change at any time — re-verify selectors before execution)
