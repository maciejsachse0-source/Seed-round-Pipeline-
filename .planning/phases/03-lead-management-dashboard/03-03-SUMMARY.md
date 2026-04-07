---
phase: 03-lead-management-dashboard
plan: "03"
subsystem: dashboard-ui
tags: [templates, scrape-trigger, react-hook-form, polling, xss-prevention]
dependency_graph:
  requires: [03-01]
  provides: [template-crud-ui, scrape-trigger-ui]
  affects: [04-email-sending]
tech_stack:
  added:
    - "@hookform/resolvers ^5.2.2 — zod resolver for react-hook-form"
  patterns:
    - "Server Components for page shells, 'use client' only for interactive forms"
    - "react-hook-form + zodResolver for client-side validation (mirrors server-side zod)"
    - "useEffect + setInterval polling for job status — clearInterval on terminal status or unmount"
    - "Plain text rendering via whitespace-pre-wrap — no dangerouslySetInnerHTML"
    - "Next.js 15+ async params — await params before accessing .id / .jobId"
key_files:
  created:
    - app/dashboard/templates/page.tsx
    - app/dashboard/templates/new/page.tsx
    - app/dashboard/templates/[id]/page.tsx
    - components/templates/TemplateForm.tsx
    - components/templates/TemplatePreview.tsx
    - app/api/scrape/[jobId]/route.ts
    - app/dashboard/scrape/page.tsx
    - components/leads/TriggerScrapeForm.tsx
  modified:
    - package.json (added @hookform/resolvers)
    - package-lock.json
decisions:
  - "Used z.number() instead of z.coerce.number() in client schema to avoid Resolver<unknown> type mismatch with react-hook-form"
  - "Polling interval 3s with immediate first poll on jobId set — no Supabase Realtime (research resolved: polling sufficient for MVP)"
  - "UUID regex validation on GET /api/scrape/[jobId] before DB query (T-03-12)"
  - "Plain text preview rendering — whitespace-pre-wrap not dangerouslySetInnerHTML (T-03-10)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 2
---

# Phase 03 Plan 03: Template UI + Scrape Trigger Summary

Template CRUD pages with live token preview and scrape job trigger with real-time polling via `useEffect` interval and `GET /api/scrape/[jobId]`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Email template list, create, edit pages with live preview | a90e437 | app/dashboard/templates/*, components/templates/* |
| 2 | Scrape trigger page with job status polling | 684df0b | app/api/scrape/[jobId]/route.ts, app/dashboard/scrape/page.tsx, components/leads/TriggerScrapeForm.tsx |

## What Was Built

### Task 1: Template Management UI

- `app/dashboard/templates/page.tsx` — Server Component that calls `fetchTemplates()` and renders a 3-column card grid (name, truncated subject, sequence position badge, active dot, edit link). Empty state message when no templates exist.
- `app/dashboard/templates/new/page.tsx` — Server Component shell rendering `<TemplateForm template={null} />` with back link.
- `app/dashboard/templates/[id]/page.tsx` — Server Component that `await params` (Next.js 15+), calls `fetchTemplateById`, redirects to `notFound()` if absent, renders `<TemplateForm template={template} />`.
- `components/templates/TemplateForm.tsx` — `'use client'` form using `react-hook-form` with `zodResolver`. Validates name (min 1, max 100), subject (min 1, max 200), body (min 1, max 5000), sequence_position (int ≥ 0). Calls `saveTemplate` Server Action on submit, redirects to `/dashboard/templates` on success. Delete button (existing templates only) with `window.confirm` before calling `deleteTemplate`. Live preview via `TemplatePreview` component updated on every keystroke via `watch()`.
- `components/templates/TemplatePreview.tsx` — `'use client'` component importing `substituteTokens` from `@/lib/queries/templates`. Substitutes sample data `{ name: 'Anna Kowalska', city: 'Kraków', category: 'biżuteria' }` into subject and body. Renders as plain text with `whitespace-pre-wrap` — no `dangerouslySetInnerHTML` (T-03-10 mitigated).

### Task 2: Scrape Trigger UI

- `app/api/scrape/[jobId]/route.ts` — `GET` Route Handler. Awaits `params` (Next.js 15+). Validates `jobId` against UUID regex before querying — returns 400 for malformed IDs (T-03-12 mitigated). Queries `scrape_jobs` table for id, status, leads_found, leads_new, leads_duplicate, started_at, completed_at, error_log. Returns 404 if job not found, otherwise 200 with job data.
- `app/dashboard/scrape/page.tsx` — Server Component with instruction text and `<TriggerScrapeForm />`.
- `components/leads/TriggerScrapeForm.tsx` — `'use client'` form with:
  - Checkbox selection for 4 OLX category paths
  - Checkbox selection for 7 city options (default: Cała Polska)
  - Optional comma-separated keywords input
  - Max pages number input (1–10, default 3)
  - On submit: builds `ScraperConfig` with fixed `delayMs: 3000, jitterMs: 1000, concurrency: 1`, POSTs to `/api/scrape`, sets `jobId` on success
  - `useEffect` polling: fetches `GET /api/scrape/{jobId}` every 3s, stops on `completed`/`failed` (T-03-14 mitigated)
  - Status display: color-coded badge (pending=yellow, running=blue+pulse, completed=green, failed=red), leads_found/leads_new/leads_duplicate grid, duration calculation, error_log display on failure, "Przejdź do leadów" link on completion
  - Form disabled while `isSubmitting || status === 'pending' || status === 'running'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used z.number() instead of z.coerce.number() in TemplateFormSchema**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `z.coerce.number()` produces `Resolver<unknown>` type which is incompatible with react-hook-form's `Resolver<TemplateFormValues>`, causing two TypeScript errors
- **Fix:** Changed `sequence_position` to `z.number().int().min(0, ...)` — the HTML number input already gives a numeric value so coercion is not needed on the client
- **Files modified:** components/templates/TemplateForm.tsx
- **Commit:** a90e437

## Known Stubs

None. All components are wired to real data sources (Supabase via Server Actions and queries, live API polling).

## Threat Flags

No new security surface beyond what is documented in the plan's threat model.

## Self-Check: PASSED

Files exist:
- FOUND: app/dashboard/templates/page.tsx
- FOUND: app/dashboard/templates/new/page.tsx
- FOUND: app/dashboard/templates/[id]/page.tsx
- FOUND: components/templates/TemplateForm.tsx
- FOUND: components/templates/TemplatePreview.tsx
- FOUND: app/api/scrape/[jobId]/route.ts
- FOUND: app/dashboard/scrape/page.tsx
- FOUND: components/leads/TriggerScrapeForm.tsx

Commits exist:
- FOUND: a90e437 (feat(03-03): email template list, create, edit pages with live preview)
- FOUND: 684df0b (feat(03-03): scrape trigger page with job status polling)
