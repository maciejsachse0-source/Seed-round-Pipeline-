---
phase: 03-lead-management-dashboard
plan: "01"
subsystem: dashboard-foundation
tags: [server-actions, query-helpers, nuqs, dashboard-layout, tdd, state-machine, zod]
dependency_graph:
  requires: [01-03]
  provides: [lib/actions/leads.ts, lib/actions/templates.ts, lib/queries/leads.ts, lib/queries/templates.ts, app/dashboard/layout.tsx]
  affects: [03-02, 03-03]
tech_stack:
  added: [nuqs@2.8.9, "@tanstack/react-table@8.21.3", react-hook-form@7.72.1]
  patterns: [server-actions, supabase-query-helpers, tdd-vitest, url-state-nuqs]
key_files:
  created:
    - app/dashboard/layout.tsx
    - components/NavLink.tsx
    - lib/actions/leads.ts
    - lib/actions/templates.ts
    - lib/queries/leads.ts
    - lib/queries/templates.ts
    - tests/actions/leads.test.ts
    - tests/actions/templates.test.ts
    - tests/leads-query.test.ts
    - tests/template-preview.test.ts
  modified:
    - app/layout.tsx
    - package.json
decisions:
  - "NuqsAdapter placed in root layout (app/layout.tsx) so all routes including non-dashboard pages benefit from URL state management"
  - "substituteTokens implemented in lib/queries/templates.ts as a pure function — no external dependency, simple regex replace per RESEARCH.md"
  - "SORTABLE_COLUMNS allowlist exported from lib/queries/leads.ts as a const tuple for use by downstream components (T-03-01 mitigated)"
  - "Secondary .order('id') added to fetchLeads for stable pagination — prevents duplicate/missing rows at page boundaries (Pitfall 6)"
metrics:
  duration: "6 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 10
  files_modified: 2
  tests_added: 30
  tests_total: 134
---

# Phase 03 Plan 01: Dashboard Foundation (Actions + Queries + Layout) Summary

**One-liner:** NuqsAdapter-wrapped dashboard layout with assertTransition-enforced Server Actions, zod-validated template CRUD, and SORTABLE_COLUMNS-guarded paginated query helpers.

## What Was Built

### Task 1: Deps + NuqsAdapter + Dashboard Layout

- Installed `nuqs@2.8.9`, `@tanstack/react-table@8.21.3`, `react-hook-form@7.72.1`
- Modified `app/layout.tsx` to wrap `{children}` with `<NuqsAdapter>` from `nuqs/adapters/next/app`
- Created `app/dashboard/layout.tsx`: Server Component sidebar layout with "Seed Round Pipeline" heading and nav links to `/dashboard` (Leady), `/dashboard/templates` (Szablony), `/dashboard/scrape` (Scraping)
- Created `components/NavLink.tsx`: `'use client'` component using `usePathname()` for active-link highlighting — active link gets `bg-blue-50 text-blue-700 font-semibold`, inactive gets `text-gray-600 hover:bg-gray-100`

### Task 2: Server Actions + Query Helpers + Tests (TDD)

**Server Actions:**
- `lib/actions/leads.ts`: `updateLeadStatus(leadId, from, to)` — guards same-status no-op, calls `assertTransition(from, to)` server-side (INFR-02/T-03-02), writes to Supabase, calls `revalidatePath` for dashboard and lead detail
- `lib/actions/templates.ts`: `saveTemplate(id, data)` — validates with `TemplateSchema` (name 1-100, subject 1-200, body 1-5000, sequence_position int>=0), upserts to `email_templates`; `deleteTemplate(id)` — removes template and revalidates

**Query Helpers:**
- `lib/queries/leads.ts`: `fetchLeads()` with SORTABLE_COLUMNS allowlist guard (T-03-01), primary + secondary `.order('id')` for stable pagination, optional status filter and search; `fetchLeadById()`; `fetchEmailHistory()`
- `lib/queries/templates.ts`: `substituteTokens()` pure function replacing `{name}`, `{city}`, `{category}` tokens; `fetchTemplates()`; `fetchTemplateById()`

**Tests (30 new, TDD):**
- `tests/actions/leads.test.ts` (5 tests): valid transition, revalidatePath calls, invalid transition, same-status no-op, Supabase error
- `tests/actions/templates.test.ts` (8 tests): insert/update/delete happy paths, zod rejection for empty name/subject/body/oversized body
- `tests/leads-query.test.ts` (11 tests): isSortable allowlist, fetchLeads pagination/filter/sort/range
- `tests/template-preview.test.ts` (6 tests): all 3 tokens, multiple occurrences, missing data, empty template

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `fa38c7d` | feat(03-01): install Phase 3 deps, wire NuqsAdapter, add dashboard nav layout |
| Task 2 | `cd9b0e7` | feat(03-01): Server Actions, query helpers, and full test coverage |

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npm test`: 134/134 tests pass (104 existing + 30 new)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All exported functions are fully implemented. Query helpers return real Supabase data; token substitution is complete. No placeholder values or hardcoded empty returns flow to UI rendering.

## Threat Flags

No new security surface introduced beyond what was planned. All T-03-0x mitigations applied:
- T-03-01 (SORTABLE_COLUMNS allowlist): implemented in `lib/queries/leads.ts`
- T-03-02 (assertTransition server-side): implemented in `lib/actions/leads.ts`
- T-03-03 (zod TemplateSchema): implemented in `lib/actions/templates.ts`
- T-03-04 (auth deferred): TODO comment added to `app/dashboard/layout.tsx`
- T-03-05 (ANON_KEY only): no changes to Supabase client configuration

## Self-Check: PASSED

Files exist:
- app/layout.tsx — FOUND (modified)
- app/dashboard/layout.tsx — FOUND (created)
- components/NavLink.tsx — FOUND (created)
- lib/actions/leads.ts — FOUND (created)
- lib/actions/templates.ts — FOUND (created)
- lib/queries/leads.ts — FOUND (created)
- lib/queries/templates.ts — FOUND (created)

Commits exist:
- fa38c7d — FOUND
- cd9b0e7 — FOUND
