# Phase 6: Additional Scrapers + Dashboard Enhancements - Research

**Researched:** 2026-04-08
**Domain:** Google Maps Places API (New), Supabase aggregate queries, Next.js streaming API routes, CSV/JSON export
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Google Maps Places API (HTTP-based) rather than Playwright browser scraping. Maps has aggressive anti-bot detection; Places API returns structured data reliably. Cost is manageable at this scale (free tier covers initial usage).
- **D-02:** The scraper must implement the existing `ScraperAdapter` interface from `lib/scrapers/types.ts` and register in `lib/scrapers/index.ts`. No changes to the ingestion pipeline — new scraper plugs into the same `ingest()` function.
- **D-03:** `sourcePlatform` in `RawLeadSchema` extends from `'olx'` to `'olx' | 'google_maps'`. Requires a Zod update and a DB migration for the constraint (if any).
- **D-04:** Simple server-rendered analytics page with aggregated counts per pipeline stage. No charting library for v1 — plain HTML/CSS bar segments or lightweight approach.
- **D-05:** Breakdown by `source_platform` column to compare OLX vs Google Maps conversion rates.
- **D-06:** Query uses Supabase aggregate (COUNT + GROUP BY status, source_platform). No materialized views needed at this scale.
- **D-07:** Export filtered leads (interested/approved status) to CSV or JSON. Client-side download via API route that streams the response.
- **D-08:** CSV format with headers matching leads table columns. JSON as array of lead objects.

### Claude's Discretion
- Analytics page layout and visual design — keep consistent with existing dashboard styling (Tailwind, minimal, functional)
- Google Maps search parameters (location radius, category mapping to Places API types)
- Whether to add a "source" filter to the existing leads table (nice-to-have if simple)

### Deferred Ideas (OUT OF SCOPE)
- Email extraction from business websites found via Google Maps (crawl website -> extract contact email)
- Source filter on existing leads table (could be quick add but not in requirements)
- Chart/graph library for richer analytics visualization (plain counts sufficient for v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRP-02 | System scrapuje dane firm handmade z Google Maps (Places API) | Google Maps Places API (New) Text Search endpoint, `got` HTTP client for POST requests, ScraperAdapter pattern extension |
| DASH-04 | User widzi analitykę lejka (konwersje per etap, per źródło) | Supabase aggregate COUNT + GROUP BY via `.select('status, source_platform, count()')`, server-rendered page pattern |
| DASH-05 | User może eksportować zainteresowanych sprzedawców do CSV/JSON | Next.js streaming API route, `Response` with `ReadableStream`, Content-Disposition header |
</phase_requirements>

---

## Summary

Phase 6 has three independent workstreams: (1) a Google Maps scraper implementing the existing `ScraperAdapter` interface using the Places API (New) Text Search endpoint via `got`, (2) a server-rendered funnel analytics page using Supabase native aggregate COUNT queries grouped by status and source_platform, and (3) a streaming export API route producing CSV or JSON for interested/approved leads.

The existing codebase is well-prepared: `ScraperAdapter`, `ScraperConfig`, `RawLead`, and the ingestion pipeline need no structural changes — only the `sourcePlatform` literal union widens from `'olx'` to `'olx' | 'google_maps'` in the Zod schema and TypeScript type. The dashboard follows established Server Component patterns; both the analytics page and the export trigger fit neatly into the existing sidebar nav and page structure.

The biggest risk is Supabase aggregate query syntax: native `count()` grouping requires PostgREST v12+ with `pgrst.db_aggregates_enabled` set — an RPC fallback (SQL function) is the safe default if the Supabase project's PostgREST version is uncertain.

**Primary recommendation:** Use `got` for Places API HTTP calls (already in the project, matches OLX scraper pattern). Use a SQL RPC for the funnel count query (safer than relying on aggregate feature flag). Use a streaming `Response` with `ReadableStream` for the export API route.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `got` | 15.0.0 (installed) | HTTP client for Places API POST requests | Already used by OlxScraper; ESM-native, retry, timeout support |
| `@supabase/supabase-js` | 2.101.1 (installed) | DB queries for analytics count and export fetch | Already the project's DB client |
| `zod` | 4.3.6 (installed) | Extend `RawLeadSchema.sourcePlatform` union; validate Places API response | Already the validation standard |

[VERIFIED: npm list output — all three already installed in project]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@googlemaps/places` | 2.4.0 (not installed) | Official Google Places (New) Node.js client | Optional: provides typed wrappers. Not needed — raw `got` POST is sufficient and matches project patterns. |

[VERIFIED: npm view @googlemaps/places version — 2.4.0 as of research date]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `got` for Places API | `@googlemaps/places` npm package | Official client adds types, but adds a dependency for a thin wrapper. `got` is already present and Maps API is simple POST — no benefit to another package. |
| RPC for aggregate query | Supabase native `count()` grouping | Native is cleaner but requires `pgrst.db_aggregates_enabled = 'true'` — a Supabase config change. RPC via `supabase.rpc()` works unconditionally. |
| Streaming `ReadableStream` | Buffer all records in memory, send as JSON | Buffering fails for large exports. Streaming is safe for any size and matches existing API route patterns. |

**Installation:**
```bash
# Nothing new to install — got, zod, @supabase/supabase-js already present
# If Google Maps API key not yet in .env.local, add:
# GOOGLE_MAPS_API_KEY=<your key>  (server-only, no NEXT_PUBLIC_ prefix — never expose to browser)
```

---

## Architecture Patterns

### Recommended Project Structure
```
lib/scrapers/
├── google-maps/
│   └── google-maps-scraper.ts   # implements ScraperAdapter
├── types.ts                     # extend sourcePlatform union
└── index.ts                     # register google_maps entry

supabase/migrations/
└── 20260408XXXXXX_google_maps_source.sql  # extend enum / check constraint if present

app/
└── dashboard/
    ├── analytics/
    │   └── page.tsx             # funnel analytics — Server Component
    └── layout.tsx               # add Analytics + Export nav links

app/api/
└── export/
    └── route.ts                 # streaming CSV/JSON download

lib/queries/
└── analytics.ts                 # fetchFunnelCounts() query helper
```

### Pattern 1: Google Maps Scraper (ScraperAdapter)

**What:** HTTP POST to Places API (New) Text Search, paginated via `nextPageToken`, produces `RawLead[]`.

**When to use:** Any scrape job with `platform: 'google_maps'`.

**Key field mappings from Places API response:**
- `displayName.text` → `name`
- `formattedAddress` → `city` (extract city from address string)
- `nationalPhoneNumber` → `phone`
- `websiteUri` → `socialLinks.website`
- `types` → `categories`
- `rating`, `userRatingCount` → available but no direct `RawLead` field (can be ignored or stored in `description`)
- `email` → always `null` (Places API does not return email addresses)

**Field mask (X-Goog-FieldMask) for cost control:**
```
places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.rating,places.userRatingCount,places.businessStatus,nextPageToken
```

Using only the fields you need keeps the SKU at the lowest billing tier. Phone + website fields trigger the "Enterprise" SKU. [CITED: developers.google.com/maps/billing-and-pricing/pricing]

**Example implementation sketch:**
```typescript
// Source: Google Maps Places API (New) Text Search docs
// https://developers.google.com/maps/documentation/places/web-service/text-search
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'

const response = await got.post(PLACES_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.rating,places.userRatingCount,nextPageToken',
  },
  json: {
    textQuery: `${keyword} ${city}`,
    pageSize: 20,
    pageToken: nextPageToken ?? undefined,
  },
}).json<PlacesResponse>()
```

### Pattern 2: sourcePlatform Schema Extension

**What:** Widen the Zod literal to a union; no ingestion pipeline changes needed.

**Example:**
```typescript
// lib/scrapers/types.ts — BEFORE
sourcePlatform: z.literal('olx'),

// AFTER
sourcePlatform: z.enum(['olx', 'google_maps']),
```

Also update the `RawLead` TypeScript interface:
```typescript
sourcePlatform: 'olx' | 'google_maps'
```

**DB note:** The `leads.source_platform` column is `text NOT NULL` with no CHECK constraint in the migration — no DB migration required for the column itself. A migration is only needed if a CHECK constraint was added later. Verify before planning. [VERIFIED: read of 20260406000001_initial_schema.sql]

### Pattern 3: Funnel Analytics Query via RPC

**What:** SQL function returning counts grouped by `(status, source_platform)`.

**Why RPC and not native aggregate:** Supabase's native `count()` grouping requires `pgrst.db_aggregates_enabled = 'true'` to be set on the Supabase project. This is a project configuration change that may not be active. An RPC is safe unconditionally. [CITED: supabase.com/blog/postgrest-aggregate-functions]

**Migration adds SQL function:**
```sql
-- supabase/migrations/XXXXXXXX_funnel_analytics_rpc.sql
CREATE OR REPLACE FUNCTION get_funnel_counts()
RETURNS TABLE(status text, source_platform text, count bigint)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT status, source_platform, COUNT(*)::bigint
  FROM leads
  WHERE opted_out = false
  GROUP BY status, source_platform
  ORDER BY status, source_platform;
$$;
```

**Query in lib/queries/analytics.ts:**
```typescript
export async function fetchFunnelCounts(): Promise<FunnelRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_funnel_counts')
  if (error) return []
  return data as FunnelRow[]
}
```

**Analytics page (Server Component, no charting library):**
```typescript
// app/dashboard/analytics/page.tsx
export default async function AnalyticsPage() {
  const rows = await fetchFunnelCounts()
  // Group rows by status, then by source_platform
  // Render plain HTML table or div-based bar segments using Tailwind
}
```

### Pattern 4: Streaming Export API Route

**What:** GET `/api/export` streams leads (filtered by status) as CSV or JSON response with `Content-Disposition: attachment`.

**Format selection:** query param `?format=csv` (default) or `?format=json`.

**Why streaming:** avoids loading all records into server RAM; consistent with Next.js Route Handler patterns. [CITED: developers.google.com Next.js Route Handlers]

```typescript
// app/api/export/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv'

  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('*')
    .in('status', ['interested', 'approved'])
    .order('created_at', { ascending: false })

  const leads = data ?? []

  if (format === 'json') {
    return new Response(JSON.stringify(leads), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="leads-export.json"',
      },
    })
  }

  // CSV: header row + one row per lead
  const CSV_HEADERS = ['id','name','email','phone','city','source_platform','status','score','created_at']
  const rows = [
    CSV_HEADERS.join(','),
    ...leads.map(l => CSV_HEADERS.map(h => JSON.stringify((l as Record<string, unknown>)[h] ?? '')).join(','))
  ]
  const csv = rows.join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.csv"',
    },
  })
}
```

**Note on streaming vs. buffered:** For the export size at this project's scale (hundreds of leads), buffering all records in memory before sending is acceptable. True `ReadableStream` streaming is only necessary at thousands+ of records. At MVP scale, build the buffered version; it is simpler and correct.

### Anti-Patterns to Avoid

- **NEXT_PUBLIC_ prefix on GOOGLE_MAPS_API_KEY:** API key must be server-only (`GOOGLE_MAPS_API_KEY`, not `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). The Places API is called server-side from the scraper worker — exposing the key to the browser would allow unlimited quota abuse.
- **Requesting all fields from Places API (`*`):** Field mask `*` triggers maximum SKU billing for every request. Always specify only the fields actually needed.
- **Adding `google_maps` platform to `ScraperConfig.categories` without mapping to Places API types:** OLX categories are URL path slugs; Places API uses a different type taxonomy (e.g., `art_gallery`, `clothing_store`). The scraper config needs a `textQuery` approach (free-text search) rather than direct category mapping.
- **Using `email: z.string().email().nullable()` strict validator on Places API output:** Places API never returns email. The field will always be `null`. The existing nullable email in `RawLeadSchema` already handles this correctly.
- **Skipping dedup:** Google Maps results for overlapping queries (different city + same business radius) can return the same business. The existing `ingest()` dedup logic handles this — do not skip it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP POST to Places API | Custom fetch wrapper | `got.post()` | Already project standard; handles retry, timeout, headers |
| CSV serialization | Custom CSV escaper | `JSON.stringify()` per field + `,` join | Handles quotes and commas in field values; sufficient for this schema |
| Aggregate query | Manual JS groupBy after fetching all rows | SQL RPC `get_funnel_counts()` | DB does the grouping — no full table scan in Node memory |
| File download trigger | Custom blob URL handler | HTTP `Content-Disposition: attachment` header | Browser handles download automatically — no client-side JS needed |

**Key insight:** The export does not require a client-side component at all. A plain `<a href="/api/export?format=csv">` in a Server Component triggers the browser download. No `useState`, no blob handling.

---

## Common Pitfalls

### Pitfall 1: Places API pagination — max 60 results total
**What goes wrong:** Assuming unlimited pages. Text Search (New) caps at 60 results (3 pages × 20) regardless of pagination. [CITED: developers.google.com/maps/documentation/places/web-service/text-search]
**Why it happens:** The `nextPageToken` field stops appearing after the third page.
**How to avoid:** Loop terminates when `nextPageToken` is absent in the response, not on an empty `places` array.
**Warning signs:** Infinite loop if code checks `places.length === 0` instead of checking `nextPageToken`.

### Pitfall 2: Places API requires awaiting pageToken availability
**What goes wrong:** Using `nextPageToken` immediately in the next request returns INVALID_REQUEST.
**Why it happens:** The token is not immediately valid — Google needs a short delay (~2 seconds) to make it available.
**How to avoid:** Add `delayWithJitter(2000, 500)` between paginated requests (reuse existing `delayWithJitter` from OLX scraper).

### Pitfall 3: `source_platform` CHECK constraint missing — but verify
**What goes wrong:** Assuming no DB change needed and a hidden CHECK constraint rejects `'google_maps'`.
**Why it happens:** The initial schema uses `text NOT NULL` with no CHECK constraint, but a later migration could have added one.
**How to avoid:** Verify all migrations before assuming no migration is needed. The three migration files in `supabase/migrations/` do not appear to add a CHECK on `source_platform`. [VERIFIED: read of initial_schema.sql — no CHECK constraint on source_platform]

### Pitfall 4: Supabase aggregate `count()` disabled by default
**What goes wrong:** Using `.select('status, count()')` in supabase-js without enabling `pgrst.db_aggregates_enabled` returns a PostgREST error.
**Why it happens:** The feature is disabled by default for performance safety. [CITED: supabase.com/blog/postgrest-aggregate-functions]
**How to avoid:** Use a SQL function via `supabase.rpc('get_funnel_counts')`. This works unconditionally on all Supabase projects.

### Pitfall 5: `ScraperConfig` mismatch — `categories` and `cities` fields are OLX-specific
**What goes wrong:** Passing OLX-style `categories` (`'antyki-i-kolekcje/rekodzielo'`) to the Google Maps scraper config, which has no concept of OLX URL slugs.
**Why it happens:** `ScraperConfig` was designed for OLX. The interface is shared, but semantics differ.
**How to avoid:** The Google Maps scraper treats `config.categories` as search keywords (e.g., `['handmade', 'rekodzielniczy']`) and `config.cities` as location strings for the `textQuery`. Document this semantic difference in the scraper class.

### Pitfall 6: Google Maps API key billing — phone numbers are Enterprise SKU
**What goes wrong:** Requesting `nationalPhoneNumber` field triggers the "Enterprise" SKU (1,000 free events/month vs 10,000 for Essentials).
**Why it happens:** Phone and website fields are in the Enterprise tier. [CITED: developers.google.com/maps/billing-and-pricing/pricing]
**How to avoid:** 1,000 free Enterprise requests/month is still likely sufficient at MVP scale (100-500 leads). Include `nationalPhoneNumber` and `websiteUri` — they are the primary value of the scraper. Monitor usage in Google Cloud Console.

---

## Code Examples

### Places API Request via `got`
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/text-search
import got from 'got'

interface PlaceResult {
  displayName?: { text: string; languageCode: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  types?: string[]
  rating?: number
  userRatingCount?: number
}

interface PlacesTextSearchResponse {
  places?: PlaceResult[]
  nextPageToken?: string
}

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',')

const result = await got.post(PLACES_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
    'X-Goog-FieldMask': FIELD_MASK,
  },
  json: {
    textQuery: 'handmade rekodzielnicze warszawa',
    pageSize: 20,
    pageToken: nextPageToken ?? undefined,
  },
  retry: { limit: 2, statusCodes: [429, 503] },
  timeout: { request: 15000 },
}).json<PlacesTextSearchResponse>()
```

### Extend RawLeadSchema
```typescript
// lib/scrapers/types.ts
// BEFORE:
sourcePlatform: z.literal('olx'),
// AFTER:
sourcePlatform: z.enum(['olx', 'google_maps']),
```

### Register scraper in index.ts
```typescript
// lib/scrapers/index.ts
import { GoogleMapsScraper } from './google-maps/google-maps-scraper'

const SCRAPERS: Record<string, new (config: ScraperConfig) => ScraperAdapter> = {
  olx: OlxScraper,
  google_maps: GoogleMapsScraper,
}
```

### Funnel Analytics SQL RPC
```sql
-- supabase/migrations/TIMESTAMP_funnel_analytics_rpc.sql
CREATE OR REPLACE FUNCTION get_funnel_counts()
RETURNS TABLE(status text, source_platform text, count bigint)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT status, source_platform, COUNT(*)::bigint
  FROM leads
  WHERE opted_out = false
  GROUP BY status, source_platform
  ORDER BY status, source_platform;
$$;
```

### Export Route
```typescript
// app/api/export/route.ts — Pattern for CSV streaming download
// Source: Next.js Route Handler docs + Web Streams API
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'csv'
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('*')
    .in('status', ['interested', 'approved'])
    .order('created_at', { ascending: false })
  const leads = data ?? []

  if (format === 'json') {
    return new Response(JSON.stringify(leads), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="leads-export.json"',
      },
    })
  }

  const HEADERS = ['id','name','email','phone','city','source_platform','status','score','created_at']
  const lines = [
    HEADERS.join(','),
    ...leads.map(l => HEADERS.map(h => JSON.stringify((l as Record<string, unknown>)[h] ?? '')).join(','))
  ]
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.csv"',
    },
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Places API (Legacy) — `maps.googleapis.com/maps/api/place/textsearch/json` | Places API (New) — `places.googleapis.com/v1/places:searchText` (POST) | 2023 | New API uses POST with field masks; billing is per-field-SKU not per-request-type |
| `$200 universal monthly credit` | Per-product-category free quotas | March 1, 2025 | Enterprise SKU: 1,000 free events/month; Essentials: 10,000 free/month |
| Supabase aggregate queries: RPC only | Native `.select('col, count()')` with PostgREST v12+ | ~2024 | Feature is disabled by default; RPC remains the safe unconditional approach |

**Deprecated/outdated:**
- Places API (Legacy) text search endpoint (`maps.googleapis.com/maps/api/place/textsearch`): still works but deprecated in favor of Places API (New). New projects should use the New API. [CITED: developers.google.com/maps/documentation/places/web-service/legacy/search-text]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No CHECK constraint on `leads.source_platform` in any migration beyond the four listed | Architecture Patterns (D-03) | Would need a DB migration to add `'google_maps'` to the constraint |
| A2 | Supabase project's PostgREST version does NOT have `pgrst.db_aggregates_enabled = 'true'` | Pitfall 4 / Pattern 3 | If it does, native `count()` grouping works — RPC still works either way (no risk) |
| A3 | Google Maps API key will be created and added to `.env.local` before Phase 6 execution | Environment Availability | Blocks the scraper entirely if missing |
| A4 | 1,000 free Enterprise SKU events/month is sufficient for initial MVP scraping volume | Common Pitfalls (Pitfall 6) | If volume exceeds 1,000 Google Maps scrape calls/month, billing charges apply ($35/1,000 after free tier) |

---

## Open Questions

1. **ScraperConfig shape for Google Maps**
   - What we know: `ScraperConfig` has `categories: string[]`, `cities: string[]`, `keywords: string[]` — all OLX-oriented.
   - What's unclear: Should Google Maps scraper reinterpret `keywords` as the `textQuery` basis, or should the scrape trigger form send different config fields for Google Maps?
   - Recommendation: The scraper class should document clearly that for `google_maps`, `keywords` elements are used as the primary search terms and `cities` elements are appended to the textQuery (e.g., `"handmade warszawa"`). No interface change needed.

2. **City extraction from `formattedAddress`**
   - What we know: Places API returns `formattedAddress` as a full string (e.g., `"ul. Marszałkowska 1, 00-001 Warszawa, Polska"`). No separate `city` field.
   - What's unclear: How reliably can city be extracted from a Polish address string?
   - Recommendation: Use a simple heuristic (second-to-last comma-separated segment, or regex for known city names). Flag as best-effort; `city` is nullable in `RawLead`.

3. **Dashboard nav labels (Polish)**
   - What we know: Existing nav links are in Polish ("Leady", "Szablony", "Sekwencje", "Scraping").
   - Recommendation: Use "Analityka" for the analytics page and "Eksport" for the export page trigger. Keep consistent with dashboard language.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 22.22.0 | — |
| `got` | Google Maps scraper HTTP | Yes (installed) | 15.0.0 | — |
| `@supabase/supabase-js` | Analytics query, export query | Yes (installed) | 2.101.1 | — |
| `zod` | RawLeadSchema extension | Yes (installed) | 4.3.6 | — |
| Google Maps API key | Places API authentication | NOT SET in .env.local | — | Blocks scraper; must be added manually |
| Supabase connection | Analytics RPC, export | Yes (DATABASE_URL set) | — | — |

**Missing dependencies with no fallback:**
- `GOOGLE_MAPS_API_KEY` environment variable — not present in `.env.local`. Must be obtained from Google Cloud Console and added before the scraper can run. This is a human action, not an engineering task. The plan should include a Wave 0 setup step.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-02 | `GoogleMapsScraper.run()` returns `RawLead[]` with `sourcePlatform: 'google_maps'` | unit (mock got) | `npx vitest run tests/google-maps-scraper.test.ts` | No — Wave 0 |
| SCRP-02 | `RawLeadSchema.parse()` accepts `sourcePlatform: 'google_maps'` | unit | `npx vitest run tests/raw-lead-schema.test.ts` | No — Wave 0 |
| SCRP-02 | `createScraper('google_maps', config)` does not throw | unit | same file | No — Wave 0 |
| DASH-04 | `fetchFunnelCounts()` returns array of `{status, source_platform, count}` | unit (mock supabase.rpc) | `npx vitest run tests/analytics.test.ts` | No — Wave 0 |
| DASH-05 | `GET /api/export?format=csv` returns 200 with `Content-Disposition: attachment` header | smoke (mock supabase) | `npx vitest run tests/export-route.test.ts` | No — Wave 0 |
| DASH-05 | `GET /api/export?format=json` returns valid JSON array | smoke (mock supabase) | same file | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/google-maps-scraper.test.ts` — covers SCRP-02 (mock `got` responses)
- [ ] `tests/raw-lead-schema.test.ts` — covers SCRP-02 schema extension
- [ ] `tests/analytics.test.ts` — covers DASH-04 (mock `supabase.rpc`)
- [ ] `tests/export-route.test.ts` — covers DASH-05 (mock `createClient`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Dashboard has no auth yet (single-user local tool) |
| V3 Session Management | No | No session state in new routes |
| V4 Access Control | No | Internal tool; no multi-user access control needed |
| V5 Input Validation | Yes | zod validates Places API response before `RawLeadSchema.parse()`; export route validates `format` param |
| V6 Cryptography | No | No new crypto required |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leakage via client-side bundle | Information Disclosure | `GOOGLE_MAPS_API_KEY` must be server-only (no `NEXT_PUBLIC_` prefix); Places API is called from scraper worker, not browser |
| CSV injection (formula injection) | Tampering | Wrap all CSV cell values in `JSON.stringify()` — produces double-quoted strings, preventing `=`, `+`, `-`, `@` prefix injection |
| Export endpoint fetching all leads (no filter) | Elevation of Privilege | Filter by `status IN ('interested', 'approved')` at DB layer, not application layer — prevents accidental full dump |
| Unvalidated `format` query parameter | Tampering | Validate: only `'csv'` and `'json'` are accepted; default to `'csv'` for any other value |

---

## Sources

### Primary (HIGH confidence)
- Google Maps Places API (New) Text Search docs — endpoint, field mask, pagination, max 60 results: https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Maps Billing and Pricing — SKU tiers, free quotas: https://developers.google.com/maps/billing-and-pricing/pricing
- Supabase PostgREST Aggregate Functions — `count()` grouping, `pgrst.db_aggregates_enabled` requirement: https://supabase.com/blog/postgrest-aggregate-functions
- Codebase: `lib/scrapers/types.ts`, `lib/scrapers/index.ts`, `lib/scrapers/olx/olx-scraper.ts`, `lib/queries/leads.ts`, `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`, `supabase/migrations/20260406000001_initial_schema.sql` — all read directly

### Secondary (MEDIUM confidence)
- Google Maps pricing change March 2025 — 1,000 free Enterprise events/month: https://www.storelocatorwidgets.com/blogpost/20499/New_Google_Maps_API_free_credit_system_from_March_1st_2025
- Next.js streaming API routes pattern: https://www.ericburel.tech/blog/nextjs-stream-files

### Tertiary (LOW confidence)
- `@googlemaps/places` npm package version 2.4.0: verified via `npm view` but package not evaluated for fitness

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages already installed and version-verified; Places API endpoint verified from official docs
- Architecture: HIGH — existing codebase patterns are clear; ScraperAdapter extension is mechanical; RPC pattern is a safe unconditional choice
- Pitfalls: HIGH — pagination cap and pageToken delay are documented in official Google Maps docs; Supabase aggregate flag from official Supabase blog

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain; Google Maps API changes are infrequent; Supabase JS client is stable)
