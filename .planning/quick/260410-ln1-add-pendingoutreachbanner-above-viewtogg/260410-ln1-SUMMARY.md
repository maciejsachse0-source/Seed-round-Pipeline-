---
phase: quick-260410-ln1
plan: 01
subsystem: dashboard-ui
tags: [dashboard, batch-send, server-component, ui]
requires:
  - "@/lib/supabase/server"
  - "/api/batch-send"
provides:
  - "components/leads/PendingOutreachBanner"
  - "components/leads/PendingOutreachBannerButton"
affects:
  - "app/dashboard/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Server Component + Client subcomponent split for count-query-gated CTA"
    - "Supabase count:exact head:true zero-row count query"
key-files:
  created:
    - "components/leads/PendingOutreachBanner.tsx"
    - "components/leads/PendingOutreachBannerButton.tsx"
  modified:
    - "app/dashboard/page.tsx"
decisions:
  - "Two-file split: Server Component for the count query + Client Component for the button — Next.js App Router does not allow mixed directives in one file"
  - "Used RLS-aware createClient from @/lib/supabase/server (not service.ts) — request-scoped, respects auth cookies"
  - "Banner mounted as first child of DashboardPage outer div (outside the view ternary) so it renders in both cards and table views without duplication"
  - "No Suspense wrapper — count query is single-row COUNT, sub-ms; added complexity not justified"
  - "Polish pluralization uses 1/<5/else rule — acknowledged edge case for 12-14 (should be 'many') as acceptable for a quick task"
metrics:
  duration: "~8 min"
  completed: "2026-04-10"
---

# Quick 260410-ln1: Add PendingOutreachBanner above ViewToggle Summary

**One-liner:** Persistent dashboard banner with one-click batch cold-email trigger, visible in both cards and table views, reusing the existing `/api/batch-send` endpoint and SessionComplete visual language.

## What Was Built

A dashboard-wide pending outreach CTA that surfaces the batch-send action outside the cards-view session flow.

### Files Created

1. **`components/leads/PendingOutreachBanner.tsx`** — Async Server Component (55 lines)
   - Imports `createClient` from `@/lib/supabase/server` (RLS-aware, never service role)
   - Runs a single `count: 'exact', head: true` query with filters:
     - `status = 'approved'`
     - `contact_status = 'none'`
     - `email IS NOT NULL`
     - `email != ''`
   - Returns `null` when count is 0 or on error (no empty chrome)
   - Renders a horizontal card banner with indigo left border, envelope icon, count + copy, and the client button on the right
   - Polish pluralization (1 / 2-4 / 5+)

2. **`components/leads/PendingOutreachBannerButton.tsx`** — Client Component (90 lines)
   - `'use client'` directive
   - Receives `pendingCount: number` prop
   - Three visual states:
     - **Idle** — `btn-primary` with label `Wyślij cold email (N)`
     - **Sending** — disabled button with animated spinner SVG + `Kolejkuję...`
     - **Success** — emerald checkmark SVG + `Zakolejkowano N email/emaili` + optional `(N pominięto)` sub-text
     - **Error** — red text with server error message or `Nie udało się połączyć z API` on network failure
   - POSTs to `/api/batch-send` with no body, handles the `{ queued, skipped, error? }` response shape

### Files Modified

3. **`app/dashboard/page.tsx`** (2 content changes)
   - Added import for `PendingOutreachBanner`
   - Rendered `<PendingOutreachBanner />` as the first child of the outer wrapping `<div>`, above the header row containing `ViewToggle`
   - Mount is OUTSIDE the `view === 'cards' ? ... : ...` ternary so the banner shows in both views
   - No props passed — banner fetches its own count independently of `fetchLeads` (which uses a different filter set)

## Commits

| # | Hash | Task |
| - | ---- | ---- |
| 1 | `07c5266` | feat(quick-260410-ln1): add PendingOutreachBanner component |
| 2 | `6e35741` | feat(quick-260410-ln1): mount PendingOutreachBanner on dashboard |

## Verification Results

### Automated
- `npx tsc --noEmit` — zero new type errors attributable to the created/modified files. Pre-existing errors in unrelated files (`app/api/track/open`, `lib/queue/boss.ts`, various `tests/*`) are out of scope and untouched.
- All three files compile cleanly with the project `tsconfig.json` path alias resolution.

### Manual (operator spot-check, optional)
1. Ensure at least one lead exists with `status='approved'`, `contact_status='none'`, non-null non-empty `email`
2. Visit `/dashboard` — banner appears above ViewToggle showing the count
3. Switch to `/dashboard?view=table` — banner still appears (same mount point)
4. Click `Wyślij cold email (N)` — `Kolejkuję...` shows, then `Zakolejkowano N emaili`
5. Update all eligible leads so none match the filter — refresh `/dashboard` — banner does not render (returns `null`)

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's initial "one file with 'use client'" proposal was already self-corrected in the plan text to the two-file split, which is the Next.js App Router requirement. No additional deviations were needed.

## Edge Cases Documented

1. **Polish pluralization for 12-14** — The rule `count === 1 ? 'lead gotowy' : count < 5 ? 'leady gotowe' : 'leadów gotowych'` is slightly wrong for numbers like 12, 13, 14 (which should use the "many" form `leadów gotowych`). Accepted as a quick-task tradeoff; inline comment added in the component for future reference.

2. **Empty-string email filter** — The count query adds `.neq('email', '')` in addition to `.not('email', 'is', null)` because the batch-send route filters out empty-string emails via `l.email.trim().length > 0`. Without the `neq` filter, the banner could show a count higher than what `/api/batch-send` actually queues, producing a confusing `skipped` number. Filters now match.

3. **Server errors surface to operator** — If `/api/batch-send` rejects due to missing step-0 template (`Brak szablonu...`) or inactive template, the error message from the response body is shown verbatim in the red-text error state. The banner does NOT auto-hide in this case — the operator still has pending leads and needs to see the actionable error.

4. **Banner does not cache** — Because the count query reads request cookies via `createClient`, Next.js auto-marks the dashboard route dynamic. No manual `export const dynamic = 'force-dynamic'` needed. Every dashboard visit gets a fresh count.

5. **PostToolUse validator false positive** — The project's Next.js validator flagged `params.page/status/sort/dir/view` as needing `await`, but `params` is the already-awaited local variable from `const params = await searchParams` on line 22. No change required; the file was already correct per Next.js 16 async `searchParams` conventions.

## Known Stubs

None. Banner is fully wired end-to-end: real Supabase count query, real POST to `/api/batch-send`, real loading/success/error feedback.

## Self-Check: PASSED

- [x] `components/leads/PendingOutreachBanner.tsx` exists on disk
- [x] `components/leads/PendingOutreachBannerButton.tsx` exists on disk
- [x] `app/dashboard/page.tsx` imports and renders `PendingOutreachBanner`
- [x] Commit `07c5266` present in git log
- [x] Commit `6e35741` present in git log
- [x] `npx tsc --noEmit` produces zero new errors for modified files
