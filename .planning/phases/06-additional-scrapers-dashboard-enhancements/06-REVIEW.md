---
phase: 06-additional-scrapers-dashboard-enhancements
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - lib/scrapers/google-maps/google-maps-scraper.ts
  - lib/scrapers/types.ts
  - lib/scrapers/index.ts
  - lib/queue/workers/scrape-worker.ts
  - app/api/scrape/route.ts
  - supabase/migrations/20260408000002_google_maps_funnel_rpc.sql
  - tests/scrapers/google-maps-scraper.test.ts
  - lib/queries/analytics.ts
  - app/dashboard/analytics/page.tsx
  - app/api/export/route.ts
  - app/dashboard/layout.tsx
  - tests/queries/analytics.test.ts
  - tests/api/export-route.test.ts
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 06 adds a Google Maps Places API scraper, funnel analytics (RPC + dashboard page), and a CSV/JSON export endpoint. The overall structure is clean and the scraper correctly implements `ScraperAdapter`. Three issues require attention before shipping: the export endpoint has no authentication and silently swallows database errors, and the SQL migration uses `SECURITY DEFINER` without pinning `search_path`, which is a PostgreSQL security best practice violation. Three warnings cover a missing env-var guard, a bad fallback URL that can corrupt deduplication, and a visual display bug in the analytics chart.

---

## Critical Issues

### CR-01: Export endpoint has no authentication — all lead PII is publicly accessible

**File:** `app/api/export/route.ts:10`

**Issue:** `GET /api/export` returns names, emails, phone numbers, cities, and scores for all `interested`/`approved` leads with no authentication check whatsoever. Any unauthenticated request (browser, curl, bot) can download the full dataset. The dashboard layout has a `TODO: Add authentication` comment, but the export route delivers sensitive PII and should be protected even before the broader auth work lands.

**Fix:** Add a session check at the top of the handler using the Supabase server client. Reject with 401 if no active session:

```typescript
export async function GET(request: Request) {
  const supabase = await createClient()

  // Require authenticated session before exporting PII
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ... rest of the handler
}
```

---

### CR-02: Database errors silently swallowed in export route — returns HTTP 200 with empty body on failure

**File:** `app/api/export/route.ts:14-21`

**Issue:** The Supabase query result destructures only `data`, not `error`. When the database query fails (connection issue, RLS denial, schema mismatch), `data` is `null`, `leads` becomes `[]`, and the route returns an HTTP 200 response with an empty CSV or empty JSON array `[]`. The caller has no way to distinguish a successful "zero leads" result from a database error.

```typescript
// Current — error is silently ignored
const { data } = await supabase
  .from('leads')
  .select('*')
  .in('status', ['interested', 'approved'])
  .order('created_at', { ascending: false })
```

**Fix:** Destructure and handle the error:

```typescript
const { data, error } = await supabase
  .from('leads')
  .select('*')
  .in('status', ['interested', 'approved'])
  .order('created_at', { ascending: false })

if (error) {
  console.error('[api/export] Supabase query error:', error)
  return new Response(JSON.stringify({ error: 'Failed to fetch leads' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })
}

const leads = data ?? []
```

---

### CR-03: SECURITY DEFINER function missing SET search_path — vulnerable to search_path hijacking

**File:** `supabase/migrations/20260408000002_google_maps_funnel_rpc.sql:7-16`

**Issue:** The `get_funnel_counts()` function is declared `SECURITY DEFINER` without pinning `search_path`. In PostgreSQL, a `SECURITY DEFINER` function runs with the privileges of the function owner (typically the migration user / service role). Without `SET search_path = public`, an attacker who can create objects in any schema ahead of `public` on the search path can shadow the `leads` table with a malicious relation and have it queried with elevated privileges.

**Fix:** Add `SET search_path = public` to the function definition:

```sql
CREATE OR REPLACE FUNCTION get_funnel_counts()
RETURNS TABLE(status text, source_platform text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, source_platform, COUNT(*)::bigint
  FROM leads
  WHERE opted_out = false
  GROUP BY status, source_platform
  ORDER BY status, source_platform;
$$;
```

---

## Warnings

### WR-01: Missing env-var guard for GOOGLE_MAPS_API_KEY — silent failure at runtime

**File:** `lib/scrapers/google-maps/google-maps-scraper.ts:107`

**Issue:** `process.env.GOOGLE_MAPS_API_KEY!` uses a non-null assertion (`!`) but performs no actual runtime check. If the env var is absent, `process.env.GOOGLE_MAPS_API_KEY` is `undefined`, which TypeScript's `!` does not catch at runtime. The `got` HTTP client will coerce it to the string `"undefined"` and send it as the API key header, resulting in a 400 or 403 from the Places API with no clear error message pointing to the missing configuration.

**Fix:** Add a guard at the top of `run()` (or in the constructor):

```typescript
async run(config: ScraperConfig): Promise<RawLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is not set')
  }
  // replace the inline !-assertion with the local variable
  // 'X-Goog-Api-Key': apiKey,
```

---

### WR-02: Fallback sourceUrl encodes empty string when name is null — corrupts deduplication

**File:** `lib/scrapers/google-maps/google-maps-scraper.ts:51-53`

**Issue:** When a `PlaceResult` has neither `websiteUri` nor `displayName.text`, the fallback `sourceUrl` becomes `https://maps.google.com/?q=` (encoding an empty string). Multiple nameless, website-less places produce the exact same `sourceUrl`. The deduplication logic downstream uses `sourceUrl` as the uniqueness signal, so all such places collapse into a single lead record instead of being stored or discarded individually.

```typescript
// When name is null AND websiteUri is absent:
const sourceUrl = place.websiteUri
  ?? `https://maps.google.com/?q=${encodeURIComponent(name ?? '')}`
// → 'https://maps.google.com/?q=' for every nameless place without a website
```

**Fix:** Return `null` or skip the place entirely when both fields are absent, or generate a unique synthetic URL using a stable place identifier if available:

```typescript
// Option A: skip places with no usable URL
if (!place.websiteUri && !name) return null
// then filter: leads.push(...) becomes if (lead) leads.push(lead)

// Option B: use place identifier if the API returns one in a future field mask addition
const sourceUrl = place.websiteUri
  ?? (name ? `https://maps.google.com/?q=${encodeURIComponent(name)}` : null)
// Then validate sourceUrl is non-null before constructing the RawLead
```

---

### WR-03: Analytics bar shows non-zero width for zero-count entries — visual display bug

**File:** `app/dashboard/analytics/page.tsx:85`

**Issue:** `Math.max(1, Math.round((count / maxCount) * 100))` forces a minimum of 1% bar width regardless of count. When a platform has zero leads for a given funnel stage, the bar still renders 1% wide instead of being invisible. A user reading the chart would incorrectly infer that some leads exist at that stage for that platform.

```typescript
// count === 0 still produces widthPct === 1
const widthPct = Math.max(1, Math.round((count / maxCount) * 100))
```

**Fix:** Only apply the minimum for non-zero counts, or use conditional rendering to omit zero-count bars:

```typescript
// Only show the bar if count > 0; hide it entirely otherwise
const widthPct = count > 0 ? Math.max(1, Math.round((count / maxCount) * 100)) : 0

// In JSX: conditionally render
<div
  className={`h-4 rounded-full ${getPlatformColor(platform)}`}
  style={{ width: widthPct > 0 ? `${widthPct}%` : '0' }}
/>
```

---

## Info

### IN-01: Duplicate PLATFORM_COLORS and PLATFORM_DOT_COLORS maps contain identical data

**File:** `app/dashboard/analytics/page.tsx:19-27`

**Issue:** `PLATFORM_COLORS` and `PLATFORM_DOT_COLORS` are two separate `Record<string, string>` constants with identical keys and values. The legend uses `PLATFORM_DOT_COLORS` directly rather than `getPlatformColor()`, so the same lookup data is maintained twice. Any future platform addition requires updating both.

**Fix:** Remove `PLATFORM_DOT_COLORS` and use `getPlatformColor()` (or the base map) for the legend dots as well:

```typescript
// Remove PLATFORM_DOT_COLORS entirely.
// In the legend JSX:
<div className={`w-3 h-3 rounded-full ${getPlatformColor(platform)}`} />
```

---

### IN-02: GoogleMapsScraper constructor stores config but run() accepts its own config parameter — stored config is never used

**File:** `lib/scrapers/google-maps/google-maps-scraper.ts:90-92`

**Issue:** The constructor accepts and stores `config` (`private config: ScraperConfig`), but `run(config: ScraperConfig)` takes its own `config` parameter and uses only that. `this.config` is never referenced. This is a minor inconsistency with the `ScraperAdapter` interface pattern but creates dead state.

**Fix:** Either remove the constructor parameter (making the stored field unnecessary) to match the pattern where config is passed entirely via `run()`, or use `this.config` as the fallback when `run()` is called without a distinct config. The OLX scraper pattern should be checked for consistency:

```typescript
// Simplest fix: remove the stored field if it serves no purpose
export class GoogleMapsScraper implements ScraperAdapter {
  name = 'google_maps'
  // no constructor needed if config is always passed to run()
```

---

_Reviewed: 2026-04-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
