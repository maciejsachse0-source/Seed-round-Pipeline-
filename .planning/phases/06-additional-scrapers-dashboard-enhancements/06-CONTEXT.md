# Phase 6: Additional Scrapers + Dashboard Enhancements - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds a second lead source (Google Maps) using the existing ScraperAdapter pattern, a funnel analytics view showing conversion counts per pipeline stage broken down by source platform, and CSV/JSON export of interested/approved sellers.

</domain>

<decisions>
## Implementation Decisions

### Google Maps Scraper Approach
- **D-01:** Use Google Maps Places API (HTTP-based) rather than Playwright browser scraping. Rationale: Maps has aggressive anti-bot detection, Places API is more reliable and returns structured data. Cost is manageable at the project's scale (free tier covers initial usage).
- **D-02:** The scraper must implement the existing `ScraperAdapter` interface from `lib/scrapers/types.ts` and register in `lib/scrapers/index.ts`. No changes to the ingestion pipeline — new scraper plugs into the same `ingest()` function.
- **D-03:** `sourcePlatform` enum in `RawLeadSchema` needs extending from `'olx'` to `'olx' | 'google_maps'`. This is a schema change that needs a Zod update and potentially a migration for the DB constraint.

### Funnel Analytics
- **D-04:** Simple server-rendered page with aggregated counts per pipeline stage (new -> scored -> approved -> contacted -> followed_up -> replied -> interested). No charting library needed for v1 — use plain HTML/CSS bar segments or a lightweight approach.
- **D-05:** Breakdown by `source_platform` column so the user can compare OLX vs Google Maps conversion rates.
- **D-06:** Query uses Supabase aggregate (COUNT + GROUP BY status, source_platform). No need for materialized views at this scale.

### Export Feature
- **D-07:** Export filtered leads (interested/approved status) to CSV or JSON. Client-side download via API route that streams the response.
- **D-08:** CSV format with headers matching the leads table columns. JSON as array of lead objects.

### Claude's Discretion
- Analytics page layout and visual design — keep consistent with existing dashboard styling (Tailwind, minimal, functional)
- Google Maps search parameters (location radius, category mapping to Places API types)
- Whether to add a "source" filter to the existing leads table (nice-to-have if simple)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scraper Pattern
- `lib/scrapers/types.ts` — ScraperAdapter interface, RawLead schema, ScraperConfig
- `lib/scrapers/index.ts` — Scraper registry (add new scraper here)
- `lib/scrapers/olx/olx-scraper.ts` — Reference implementation of ScraperAdapter
- `lib/pipeline/ingest.ts` — Ingestion pipeline that all scrapers feed into

### Dashboard Pattern
- `app/dashboard/page.tsx` — Existing leads table page (Server Component pattern)
- `app/dashboard/layout.tsx` — Sidebar nav (add new pages here)
- `lib/queries/leads.ts` — Existing query helpers pattern

### State Machine
- `lib/state-machine/lead-states.ts` — Status enum for funnel stages

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScraperAdapter` interface: Google Maps scraper implements `run(config)` returning `RawLead[]`
- `ingest()` pipeline: handles dedup, normalization, scoring — no changes needed
- `scrape-worker.ts`: pg-boss worker already dispatches by platform name
- `LeadsTable`, `LeadsFilters`, `Pagination`: existing dashboard components
- `fetchLeads()`: existing query helper with filter/sort/pagination

### Established Patterns
- Server Components for data-fetching pages, Client Components only for interactivity
- Tailwind CSS for styling, no component library
- Server Actions for mutations, API routes for streaming/downloads
- Zod validation at trust boundaries

### Integration Points
- `lib/scrapers/index.ts` SCRAPERS registry — add `google_maps: GoogleMapsScraper`
- `app/dashboard/layout.tsx` — add nav links for Analytics and Export
- `RawLeadSchema` `sourcePlatform` — extend to include `'google_maps'`
- `scrape-worker.ts` — already supports any registered platform via `createScraper()`

</code_context>

<specifics>
## Specific Ideas

- STATE.md open item: "Decide: Google Maps scraper via Places API (cost?) vs Playwright (fragility?) — validate before Phase 6 planning" — resolved in D-01 favoring Places API
- Google Maps scraper should extract: business name, phone, website (for email extraction), address/city, categories, rating, review count
- Email extraction from Google Maps: most businesses list websites, not direct emails. Scraper should capture website URL; email extraction from websites is a potential v2 enhancement

</specifics>

<deferred>
## Deferred Ideas

- Email extraction from business websites found via Google Maps (crawl website -> extract contact email)
- Source filter on existing leads table (could be quick add but not in requirements)
- Chart/graph library for richer analytics visualization (plain counts sufficient for v1)

</deferred>

---

*Phase: 06-additional-scrapers-dashboard-enhancements*
*Context gathered: 2026-04-08*
