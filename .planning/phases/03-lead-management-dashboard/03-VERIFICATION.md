---
phase: 03-lead-management-dashboard
verified: 2026-04-06T13:25:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /dashboard and confirm leads table renders with pagination, filter dropdown, and search input visible"
    expected: "Table shows paginated rows with columns Nazwa, Email, Miasto, Zrodlo, Status, Score, Data. Status dropdown updates URL param. Search input debounces and updates results."
    why_human: "UI rendering and interactive URL state updates cannot be verified by grep/static analysis alone"
  - test: "Click a status dropdown for any lead, change from 'Nowy' to 'Oceniony', observe optimistic update"
    expected: "Dropdown value flips instantly (optimistic). After server round-trip the value persists on page reload. Invalid transitions are not offered as options."
    why_human: "Optimistic UI timing and state machine enforcement require browser interaction to confirm"
  - test: "Open a lead detail page at /dashboard/leads/{uuid} and scroll to 'Historia emaili' section"
    expected: "Full lead info card renders. Email history section shows either event rows or 'Brak wyslanych emaili' message."
    why_human: "Conditional rendering of email history section requires a real lead with/without email events"
  - test: "Navigate to /dashboard/templates/new, fill in all fields, and submit the form"
    expected: "Live preview in right column updates token substitution as you type. Form validates client-side (empty fields rejected). On submit, redirects to /dashboard/templates."
    why_human: "Live preview update cadence and form validation UX require manual interaction"
  - test: "Navigate to /dashboard/scrape, select at least one category, click 'Uruchom scraping'"
    expected: "POST to /api/scrape fires. Job status panel appears with 'Oczekuje' or 'W trakcie' badge. After job completes, leads_found/leads_new/leads_duplicate stats appear and 'Przejdz do leadow' link is shown."
    why_human: "Polling lifecycle and job status display require a live Supabase + pg-boss environment"
---

# Phase 3: Lead Management Dashboard — Verification Report

**Phase Goal:** The user can view, filter, and manually manage all scraped leads through a web dashboard before any automated outreach begins.
**Verified:** 2026-04-06T13:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | User can view a paginated, filterable, sortable table of all leads with their current status and score | VERIFIED | `app/dashboard/page.tsx` awaits searchParams, calls `fetchLeads()`, passes data to `LeadsTable` + `LeadsFilters` + `Pagination` |
| 2 | User can manually change a lead's status and the change persists | VERIFIED | `LeadStatusSelect` uses `useOptimistic` + `updateLeadStatus` Server Action; action calls `assertTransition` then writes to Supabase |
| 3 | User can view the full email history for a specific lead | VERIFIED | `app/dashboard/leads/[id]/page.tsx` calls `fetchEmailHistory(id)` and renders timeline with status badges |
| 4 | User can create and edit email templates with personalization tokens | VERIFIED | `TemplateForm` + `TemplatePreview` with `substituteTokens`; `saveTemplate` Server Action with zod validation on both client and server |
| 5 | User can trigger a scrape job for a chosen platform and parameters directly from the dashboard | VERIFIED | `TriggerScrapeForm` POSTs to `/api/scrape`, polls `GET /api/scrape/[jobId]` every 3s, stops on terminal status |

**Score:** 5/5 roadmap success criteria — all verified

---

### Observable Truths (Plan Must-Haves)

#### Plan 01 — Foundation

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NuqsAdapter wraps dashboard routes so useQueryState works | VERIFIED | `app/layout.tsx` line 2: `import { NuqsAdapter } from 'nuqs/adapters/next/app'`, line 18: `<NuqsAdapter>{children}</NuqsAdapter>` |
| 2 | Dashboard layout has navigation links to leads, templates, and scrape sections | VERIFIED | `app/dashboard/layout.tsx` renders NavLink to `/dashboard`, `/dashboard/templates`, `/dashboard/scrape` |
| 3 | updateLeadStatus Server Action calls assertTransition before DB write | VERIFIED | `lib/actions/leads.ts` line 19: `assertTransition(from, to)` called before Supabase `.update()` at line 25 |
| 4 | saveTemplate Server Action validates with zod before DB write | VERIFIED | `lib/actions/templates.ts` line 20: `TemplateSchema.safeParse(data)` before any Supabase call |
| 5 | Paginated query helper builds correct Supabase .range()/.order()/.eq() from params | VERIFIED | `lib/queries/leads.ts` lines 44-47: `.order(sortCol)`, `.order('id')`, `.range(from, to)`; `.eq('status', ...)` conditional at line 35 |

#### Plan 02 — Leads Table UI

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | User sees a paginated table of leads with name, email, city, status, score, date columns | VERIFIED | `LeadsTable.tsx` defines 7 columns: name, email, city, source_platform, status, score, created_at |
| 7 | User can filter leads by status using a dropdown that updates the URL | VERIFIED | `LeadsFilters.tsx` uses `useQueryState('status', ...)`, `handleStatusChange` resets page to 1 |
| 8 | User can sort leads by clicking column headers | VERIFIED | `SortHeader` function in `LeadsTable.tsx` calls `handleSort(col)` which updates `sort` and `dir` URL params via nuqs |
| 9 | User can change page using pagination controls | VERIFIED | `Pagination.tsx` uses `useQueryState('page', parseAsInteger)`, prev/next buttons call `setPage()` |
| 10 | User can change a lead's status via dropdown and the change persists | VERIFIED | `LeadStatusSelect.tsx` calls `updateLeadStatus` Server Action which writes to Supabase and calls `revalidatePath` |
| 11 | User can view a lead's detail page with full info and email history | VERIFIED | `app/dashboard/leads/[id]/page.tsx` fetches lead + email history, renders 2-col info grid and history timeline |

#### Plan 03 — Templates + Scrape Trigger

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 12 | User can see a list of all email templates | VERIFIED | `app/dashboard/templates/page.tsx` calls `fetchTemplates()` from `@/lib/queries/templates`, renders card grid |
| 13 | User can create a new email template with name, subject, body, and sequence position | VERIFIED | `TemplateForm.tsx` react-hook-form + zodResolver; `saveTemplate` Server Action inserts into `email_templates` |
| 14 | User can edit an existing email template | VERIFIED | `app/dashboard/templates/[id]/page.tsx` awaits params, calls `fetchTemplateById`, renders `TemplateForm` with existing data |
| 15 | User sees a live preview with {name}, {city}, {category} tokens substituted | VERIFIED | `TemplatePreview.tsx` imports `substituteTokens` from `lib/queries/templates`, renders substituted output as plain text (`whitespace-pre-wrap`) |
| 16 | User can trigger a scrape job from the dashboard | VERIFIED | `TriggerScrapeForm.tsx` POSTs to `/api/scrape` with `ScraperConfig` body including categories, cities, keywords, maxPages |
| 17 | User can see the status of a triggered scrape job updating in real time (polling) | VERIFIED | `useEffect` in `TriggerScrapeForm.tsx` polls `GET /api/scrape/${jobId}` every 3000ms, clears interval on `completed`/`failed` |

**Score:** 13/13 plan must-haves verified (plans 01+02+03 combined)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/layout.tsx` | NuqsAdapter wrapper | VERIFIED | Contains `NuqsAdapter` import and wraps `{children}` |
| `app/dashboard/layout.tsx` | Dashboard navigation shell | VERIFIED | Contains nav with "Leady", "Szablony", "Scraping" links |
| `lib/actions/leads.ts` | updateLeadStatus Server Action | VERIFIED | `'use server'` directive, exports `updateLeadStatus`, calls `assertTransition` |
| `lib/actions/templates.ts` | saveTemplate, deleteTemplate Server Actions | VERIFIED | `'use server'` directive, exports both, zod `TemplateSchema` validation |
| `lib/queries/leads.ts` | Paginated leads query + email history | VERIFIED | Exports `fetchLeads`, `fetchLeadById`, `fetchEmailHistory`, `SORTABLE_COLUMNS`, `isSortable` |
| `lib/queries/templates.ts` | substituteTokens + template queries | VERIFIED | Exports `substituteTokens`, `fetchTemplates`, `fetchTemplateById` |
| `app/dashboard/page.tsx` | Leads table Server Component | VERIFIED | Awaits `searchParams`, calls `fetchLeads`, passes data to client components |
| `app/dashboard/leads/[id]/page.tsx` | Lead detail page | VERIFIED | Awaits `params`, calls `notFound()` on missing lead, renders email history |
| `components/leads/LeadsTable.tsx` | TanStack Table with manualPagination | VERIFIED | `useReactTable` with `manualPagination: true`, 7 columns, sort via nuqs |
| `components/leads/LeadsFilters.tsx` | Filter bar with nuqs | VERIFIED | `useQueryState` for status and search, 300ms debounce via `useRef` |
| `components/leads/LeadStatusSelect.tsx` | Status dropdown with optimistic update | VERIFIED | `useOptimistic` + `useTransition`, only renders `VALID_TRANSITIONS[status]` as options |
| `components/leads/Pagination.tsx` | Page navigation controls | VERIFIED | `useQueryState('page', parseAsInteger)`, hidden when `totalPages <= 1` |
| `app/dashboard/templates/page.tsx` | Template list page | VERIFIED | Calls `fetchTemplates()`, renders card grid |
| `app/dashboard/templates/new/page.tsx` | New template page | VERIFIED | Renders `<TemplateForm template={null} />` |
| `app/dashboard/templates/[id]/page.tsx` | Edit template page | VERIFIED | Awaits `params`, calls `fetchTemplateById`, calls `notFound()` if absent |
| `components/templates/TemplateForm.tsx` | Template create/edit form | VERIFIED | `react-hook-form` + `zodResolver`, `saveTemplate` Server Action, live preview via `TemplatePreview` |
| `components/templates/TemplatePreview.tsx` | Live token substitution preview | VERIFIED | Imports `substituteTokens`, renders as plain text (`whitespace-pre-wrap`), no `dangerouslySetInnerHTML` |
| `app/dashboard/scrape/page.tsx` | Scrape trigger page | VERIFIED | Renders `<TriggerScrapeForm />` |
| `app/api/scrape/[jobId]/route.ts` | Job status polling endpoint | VERIFIED | UUID validation, queries `scrape_jobs`, returns 400/404/200 |
| `components/leads/TriggerScrapeForm.tsx` | Scrape form with status polling | VERIFIED | POSTs to `/api/scrape`, polls `GET /api/scrape/${jobId}` every 3s |
| `tests/actions/leads.test.ts` | updateLeadStatus tests | VERIFIED | 5 tests: valid transition, revalidatePath, invalid transition, no-op, DB error |
| `tests/actions/templates.test.ts` | saveTemplate tests | VERIFIED | 8 tests: insert/update/delete, zod rejections |
| `tests/leads-query.test.ts` | fetchLeads query builder tests | VERIFIED | 11 tests: isSortable, pagination, filter, sort |
| `tests/template-preview.test.ts` | substituteTokens tests | VERIFIED | 6 tests: all 3 tokens, multiple occurrences, missing data, empty string |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/actions/leads.ts` | `lib/state-machine/lead-states.ts` | `assertTransition` import | WIRED | Line 7: `import { assertTransition, LeadStatus }`, line 19: `assertTransition(from, to)` |
| `lib/queries/leads.ts` | Supabase | `.from('leads')` | WIRED | Line 32: `.from('leads').select(...)` with `.order()` and `.range()` |
| `app/dashboard/page.tsx` | `lib/queries/leads.ts` | `fetchLeads` import | WIRED | Imports and calls `fetchLeads({ page, status, sort, dir, search })` |
| `components/leads/LeadStatusSelect.tsx` | `lib/actions/leads.ts` | Server Action import | WIRED | Imports `updateLeadStatus`, calls inside `startTransition` |
| `components/leads/LeadsFilters.tsx` | URL searchParams | nuqs `useQueryState` | WIRED | 9 `useQueryState` calls across all client components |
| `components/templates/TemplateForm.tsx` | `lib/actions/templates.ts` | `saveTemplate` Server Action | WIRED | Imports `saveTemplate, deleteTemplate`, calls on form submit / delete |
| `components/templates/TemplatePreview.tsx` | `lib/queries/templates.ts` | `substituteTokens` import | WIRED | Line 4: import; lines 22, 27: used in JSX for subject and body |
| `components/leads/TriggerScrapeForm.tsx` | `app/api/scrape/route.ts` | fetch POST | WIRED | Line 124: `fetch('/api/scrape', { method: 'POST', ... })` |
| `components/leads/TriggerScrapeForm.tsx` | `app/api/scrape/[jobId]/route.ts` | fetch GET polling | WIRED | Line 58: `fetch(\`/api/scrape/${jobId}\`)` inside polling `useEffect` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LeadsTable.tsx` | `leads` prop | `fetchLeads()` in `app/dashboard/page.tsx` → Supabase `.from('leads').select(...)` | Yes — Supabase query with `.range()` and `.order()` | FLOWING |
| `app/dashboard/leads/[id]/page.tsx` | `emailHistory` | `fetchEmailHistory(id)` → Supabase `.from('email_events').select('*').eq('lead_id', ...)` | Yes — parameterized DB query | FLOWING |
| `TemplatePreview.tsx` | `subject`, `body` props | `watch('subject')`, `watch('body')` from react-hook-form in `TemplateForm` | Yes — live user input via `watch()` | FLOWING |
| `TriggerScrapeForm.tsx` | `jobStatus` | `GET /api/scrape/${jobId}` → Supabase `.from('scrape_jobs').select(...)` | Yes — DB query from route handler | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| 134 tests pass | `npm test` | 134/134 passed (15 test files) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | 0 errors | PASS |
| All Phase 3 deps installed | `package.json` entries | nuqs@2.8.9, @tanstack/react-table@8.21.3, react-hook-form@7.72.1, @hookform/resolvers@^5.2.2 | PASS |
| No `dangerouslySetInnerHTML` in template preview | grep | Not found in any component file | PASS |
| `manualPagination: true` in table | grep | `LeadsTable.tsx` line 150 confirmed | PASS |
| Polling stops on terminal status | code inspection | `clearInterval` called when `status === 'completed' \|\| status === 'failed'` | PASS |
| UUID validation on job status endpoint | code inspection | `UUID_REGEX.test(jobId)` before DB query, returns 400 if invalid | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DASH-01 | 03-01, 03-02 | User sees leads table with filtering, sorting, search | SATISFIED | `app/dashboard/page.tsx` + `LeadsTable` + `LeadsFilters` + `Pagination` |
| DASH-02 | 03-01, 03-02 | User can manually change lead status | SATISFIED | `LeadStatusSelect` → `updateLeadStatus` Server Action → Supabase |
| DASH-03 | 03-01, 03-02 | User sees email history per lead | SATISFIED | `app/dashboard/leads/[id]/page.tsx` renders `fetchEmailHistory` results |
| DASH-06 | 03-01, 03-03 | User can configure email templates and follow-up sequences | SATISFIED | Template list/create/edit pages; `saveTemplate`/`deleteTemplate` Server Actions with zod validation |
| DASH-07 | 03-03 | User can trigger scraping from dashboard | SATISFIED | `TriggerScrapeForm` POSTs to existing `/api/scrape` endpoint with full `ScraperConfig` |

All 5 Phase 3 requirements satisfied. No orphaned or unmapped requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `app/dashboard/layout.tsx` | `TODO: Add authentication when dashboard is deployed publicly` | Info | Intentional deferral per plan threat model (T-03-04: single-user local tool, auth deferred) |
| `components/leads/Pagination.tsx` | `return null` when `totalPages <= 1` | Info | Not a stub — intentional UX decision documented in 03-02-SUMMARY.md decisions |

No blocker anti-patterns. All `return null` / `return {}` instances are either guarded early-returns or error paths, not stub implementations.

---

## Human Verification Required

Five items require browser + live Supabase environment to confirm:

### 1. Leads Table Renders and URL Filters Work

**Test:** Navigate to `/dashboard`. Confirm the table renders. Change the status filter dropdown — observe the URL update to `?status=new` etc. Type in the search box — observe 300ms debounce before URL updates.
**Expected:** Table shows paginated rows with all 7 columns. Filter and sort state persists across page reload (URL-driven).
**Why human:** UI rendering, interactive URL state changes, and debounce timing cannot be verified statically.

### 2. Optimistic Status Change and State Machine Enforcement

**Test:** On the leads table, find a lead with status "Nowy". Open its status dropdown — verify only valid next states are shown (e.g. "Oceniony", not "Skontaktowany"). Select "Oceniony".
**Expected:** Dropdown flips instantly (optimistic). After reload, status persists as "Oceniony". Terminal statuses like "Odrzucony" render a disabled select with no options.
**Why human:** Optimistic update timing and state machine option filtering require browser interaction.

### 3. Lead Detail Page — Email History Section

**Test:** Open a lead at `/dashboard/leads/{uuid}`. Scroll to "Historia emaili" section.
**Expected:** Full info grid renders with all available fields. Email history shows either event rows with correct status badges or the "Brak wyslanych emaili" empty state.
**Why human:** Conditional email history rendering requires a real lead record in Supabase.

### 4. Template Form Live Preview

**Test:** Navigate to `/dashboard/templates/new`. Type `Cześć {name}` in the body field.
**Expected:** Right-column preview immediately shows `Cześć Anna Kowalska` (sample data substituted). Submit without filling the name field — verify inline validation error appears before any server call.
**Why human:** Keystroke-level live preview updates and client-side validation UX require manual interaction.

### 5. Scrape Trigger Lifecycle

**Test:** Navigate to `/dashboard/scrape`. Select at least one category. Click "Uruchom scraping".
**Expected:** Status panel appears with yellow "Oczekuje" badge. After 3s polling, badge updates to blue "W trakcie" (animated pulse). On completion, green "Zakończony" badge and stats grid (Znaleziono/Nowe/Duplikaty) appear with a "Przejdz do leadow" link. Form stays disabled throughout.
**Why human:** Polling lifecycle and job status progression require a live pg-boss + OLX scraper environment.

---

## Gaps Summary

No automated gaps found. All 13 plan must-haves pass all four levels of verification (exists, substantive, wired, data-flowing). Five human verification items remain that require a running Supabase + browser environment to confirm UI behaviour, optimistic update timing, and the scrape job polling lifecycle.

---

_Verified: 2026-04-06T13:25:00Z_
_Verifier: Claude (gsd-verifier)_
