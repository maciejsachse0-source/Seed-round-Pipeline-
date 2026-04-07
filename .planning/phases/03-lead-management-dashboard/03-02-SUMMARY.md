---
phase: 03-lead-management-dashboard
plan: "02"
subsystem: dashboard-ui
tags: [next.js, react, tanstack-table, nuqs, server-components, server-actions, optimistic-ui]
dependency_graph:
  requires: [03-01]
  provides: [leads-table-page, lead-detail-page, lead-status-select]
  affects: [dashboard-navigation]
tech_stack:
  added: []
  patterns:
    - TanStack Table v8 with manualPagination for server-side paginated data
    - nuqs useQueryState for URL-synced filter/sort/page state
    - useOptimistic + useTransition for instant status change feedback
    - Server Component reads searchParams (awaited) and passes data to Client Components
key_files:
  created:
    - app/dashboard/page.tsx
    - app/dashboard/leads/[id]/page.tsx
    - components/leads/LeadsTable.tsx
    - components/leads/LeadsFilters.tsx
    - components/leads/LeadStatusSelect.tsx
    - components/leads/Pagination.tsx
  modified: []
decisions:
  - LeadsTable SortHeader defined as inner function to close over sort/dir/setSort/setDir without prop drilling
  - LeadStatusSelect renders current status as first option plus only VALID_TRANSITIONS[currentStatus] to enforce state machine on client
  - Terminal statuses (rejected, opted_out) render disabled select with zero transition options
  - Score color thresholds: green >=70, yellow 40-69, red <40 (matching scoring module convention)
  - Pagination hides itself when totalPages <= 1 to reduce visual noise
metrics:
  duration_minutes: 25
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 3 Plan 2: Lead Management Dashboard UI Summary

**One-liner:** Paginated leads table with URL-state filters + optimistic status dropdown enforcing state machine + full lead detail page with email history timeline.

## What Was Built

Plan 03-02 delivers the operational UI layer over the server infrastructure from Plan 03-01. The dashboard is now fully functional for manual lead review.

### Task 1: Leads Table Page (4 files)

**`app/dashboard/page.tsx`** — Server Component that awaits `searchParams` (Next.js 15+ async requirement), parses `page`, `status`, `sort`, `dir`, `search` params, calls `fetchLeads()`, and renders the table with filter and pagination components.

**`components/leads/LeadsTable.tsx`** — Client Component using TanStack Table v8 with `manualPagination: true` (critical: data is pre-paginated server-side). Column headers are clickable buttons that update `sort` and `dir` URL params via nuqs. Score is color-coded (green/yellow/red). Name column links to `/dashboard/leads/{id}`.

**`components/leads/LeadsFilters.tsx`** — Client Component with status dropdown and debounced search input (300ms, using `useRef` for stable timer). Both update URL params via nuqs and reset `page` to 1 on change.

**`components/leads/Pagination.tsx`** — Client Component with previous/next buttons, page indicator, and disabled states. Hidden when `totalPages <= 1`.

### Task 2: Status Select + Lead Detail Page (2 files)

**`components/leads/LeadStatusSelect.tsx`** — Client Component implementing T-03-06 mitigation: only renders `VALID_TRANSITIONS[currentStatus]` as `<option>` elements — never all 9 statuses. Uses `useOptimistic` for instant feedback and `useTransition` for non-blocking Server Action call. Terminal statuses (`rejected`, `opted_out`) render a disabled select.

**`app/dashboard/leads/[id]/page.tsx`** — Server Component that awaits `params` before accessing `.id`, calls `notFound()` when lead is missing, fetches email history, renders a 2-column info grid with all lead fields, social links section, and email history timeline with status badges and timestamps.

## Acceptance Criteria — Verified

- [x] `app/dashboard/page.tsx` awaits `searchParams` before accessing properties
- [x] `app/dashboard/page.tsx` calls `fetchLeads` with parsed URL params
- [x] `components/leads/LeadsTable.tsx` uses `useReactTable` with `manualPagination: true`
- [x] `components/leads/LeadsTable.tsx` renders `Link` to `/dashboard/leads/{id}` in name column
- [x] `components/leads/LeadsFilters.tsx` uses `useQueryState` for status and search
- [x] `components/leads/Pagination.tsx` uses `useQueryState` for page navigation
- [x] Column headers are clickable for sorting, updating URL params `sort` and `dir`
- [x] `components/leads/LeadStatusSelect.tsx` only renders `VALID_TRANSITIONS[currentStatus]` as options
- [x] `components/leads/LeadStatusSelect.tsx` uses `useOptimistic` + `useTransition`
- [x] `components/leads/LeadStatusSelect.tsx` calls `updateLeadStatus` Server Action
- [x] `app/dashboard/leads/[id]/page.tsx` awaits `params` before accessing `.id`
- [x] `app/dashboard/leads/[id]/page.tsx` calls `notFound()` when lead not found
- [x] `app/dashboard/leads/[id]/page.tsx` renders email history from `fetchEmailHistory`
- [x] Terminal statuses render disabled select
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` — zero errors)
- [x] All 134 existing tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed debounce timer leak in LeadsFilters**
- **Found during:** Task 1 implementation
- **Issue:** Initial implementation used a bare `let debounceTimer` variable that gets recreated every render, causing the previous timer reference to be lost and preventing cleanup.
- **Fix:** Changed to `useRef<ReturnType<typeof setTimeout> | null>(null)` for stable timer reference across renders.
- **Files modified:** `components/leads/LeadsFilters.tsx`
- **Commit:** 4a1cc47

**2. [Rule 3 - Blocking] Installed npm dependencies in worktree**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** Worktree had `nuqs` and `@tanstack/react-table` in `package.json` but `node_modules/` did not exist — packages were installed in the main repo tree but not this worktree.
- **Fix:** Ran `npm install` in the worktree to install all dependencies.
- **Files modified:** None (node_modules only)
- **Commit:** N/A (not committed)

## Known Stubs

None. All components are wired to real data sources:
- `LeadsTable` receives server-fetched `leads` array and `rowCount` from `fetchLeads()`
- `LeadStatusSelect` calls the real `updateLeadStatus` Server Action
- Lead detail page fetches from `fetchLeadById()` and `fetchEmailHistory()`
- Filters and pagination update real URL params read by the Server Component

## Threat Flags

No new threat surface introduced. All mitigations from threat model applied:

| Threat | Status |
|--------|--------|
| T-03-06: Invalid transition via LeadStatusSelect | Mitigated — only valid transitions rendered as options; Server Action calls `assertTransition()` as second barrier |
| T-03-07: Sort column injection | Mitigated — `isSortable()` allowlist in `lib/queries/leads.ts` (Plan 01) applied before `.order()` |
| T-03-09: Search input DoS | Mitigated — Supabase `.ilike()` uses parameterized query; 300ms debounce on client |

## Commits

| Hash | Description |
|------|-------------|
| 4a1cc47 | feat(03-02): leads table page with filters, sorting, and pagination |
| a152a92 | feat(03-02): lead status select + lead detail page with email history |

## Self-Check: PASSED

- [x] `app/dashboard/page.tsx` — FOUND
- [x] `app/dashboard/leads/[id]/page.tsx` — FOUND
- [x] `components/leads/LeadsTable.tsx` — FOUND
- [x] `components/leads/LeadsFilters.tsx` — FOUND
- [x] `components/leads/LeadStatusSelect.tsx` — FOUND
- [x] `components/leads/Pagination.tsx` — FOUND
- [x] Commit `4a1cc47` — FOUND
- [x] Commit `a152a92` — FOUND
