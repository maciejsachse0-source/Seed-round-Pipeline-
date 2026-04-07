# Phase 3: Lead Management Dashboard - Research

**Researched:** 2026-04-06
**Domain:** Next.js 16 App Router UI — data tables, Server Actions, URL state, forms
**Confidence:** HIGH (core patterns) / MEDIUM (nuqs, TanStack Table integration specifics)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Paginated, filterable, sortable table of leads with status and score | URL search params via nuqs + Supabase `.range()` + TanStack Table v8 (manualPagination) |
| DASH-02 | Manual status change that persists (all 9 statuses) | Server Action + `assertTransition()` from existing state machine + `revalidatePath` |
| DASH-03 | Full email history view for a specific lead | Dynamic route `/dashboard/leads/[id]` fetching email_events joined to lead |
| DASH-06 | Create and edit email templates with {name}/{city}/{category} tokens | Server Action form (textarea) + live token preview in Client Component |
| DASH-07 | Trigger scrape jobs from dashboard with platform/params | Client Component form → existing `POST /api/scrape` route (already built in Phase 2) |
</phase_requirements>

---

## Summary

Phase 3 builds the operational heart of the pipeline: a dashboard where the operator sees every scraped lead, changes statuses, reviews email history, manages templates, and fires scrape jobs — all before any email is sent. The existing codebase already provides all the server-side primitives needed: the `leads`, `email_events`, `scrape_jobs`, and `email_templates` tables are live in Supabase; the lead state machine with `assertTransition()` is in `lib/state-machine/lead-states.ts`; the `POST /api/scrape` route is working; Supabase SSR clients are configured for both Server Components and Client Components. Phase 3 is pure UI wiring over existing infrastructure.

The recommended architecture uses **URL search params as the single source of truth for table state** (page, filters, sort). Server Components read `searchParams`, query Supabase directly, and render the initial HTML. A thin Client Component shell wraps the table for interactivity (column sorting, row selection). Status mutations go through **Server Actions** with `revalidatePath` — no separate API routes needed. The `nuqs` library (2.8.9, used by Supabase itself) handles type-safe URL state updates on the client side with a `useQueryState` API identical to `useState`.

This architecture keeps the critical "dashboard before email" invariant: all lead approvals go through manual status changes that enforce the state machine, so no lead can be emailed without explicit operator sign-off.

**Primary recommendation:** URL-state-driven Server Component table + Server Actions for mutations + nuqs for type-safe filter/pagination controls. No TanStack Query needed — Supabase queries run directly in Server Components.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.2 (installed) | Page routing, Server Components, Server Actions | Already in project |
| @supabase/supabase-js | 2.101.1 (installed) | DB queries from Server Components | Already in project |
| @supabase/ssr | 0.10.0 (installed) | SSR-safe Supabase client | Already in project |
| Tailwind CSS | 4.2.2 (installed) | Utility styling | Already in project |
| nuqs | 2.8.9 (npm latest) | Type-safe URL search params state | Used by Supabase, Vercel, Sentry; `useState` API synced to URL |
| @tanstack/react-table | 8.21.3 (npm latest) | Headless table primitive | Handles column defs, sorting state, pagination state — no CSS bundled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.72.1 (npm latest) | Template create/edit form | Controlled form with validation for multi-field template editor |
| zod | 4.3.6 (installed) | Schema validation for form inputs | Validate template fields before Server Action; already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nuqs | Manual URLSearchParams in useRouter | nuqs gives type safety and React.useState-like API; manual approach is verbose and error-prone |
| @tanstack/react-table | Plain `<table>` with useState | TanStack handles column def types, sorting state, pagination model; plain table is fine for static data but gets messy with sort + filter + select |
| react-hook-form | Controlled React state | react-hook-form reduces re-renders on large forms; for a 3-field template form it's optional but consistent with CLAUDE.md pattern |

**Installation (new packages only):**
```bash
npm install nuqs @tanstack/react-table react-hook-form
```

**Version verification:** [VERIFIED: npm registry]
- `nuqs`: 2.8.9 (latest, supports Next.js >=14.2.0)
- `@tanstack/react-table`: 8.21.3 (latest stable; v9 alpha exists, do not use)
- `react-hook-form`: 7.72.1 (latest stable; v8 alpha exists, do not use)

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── dashboard/
│   ├── page.tsx                  # Leads table (Server Component, reads searchParams)
│   ├── leads/
│   │   └── [id]/
│   │       └── page.tsx          # Lead detail + email history (Server Component)
│   ├── templates/
│   │   ├── page.tsx              # Template list (Server Component)
│   │   └── [id]/
│   │       └── page.tsx          # Template edit (Server Component shell)
│   └── layout.tsx                # Dashboard nav shell (Server Component)
components/
├── leads/
│   ├── LeadsTable.tsx            # 'use client' — TanStack table, nuqs filters
│   ├── LeadStatusSelect.tsx      # 'use client' — optimistic status dropdown
│   ├── LeadsFilters.tsx          # 'use client' — filter bar, nuqs state
│   └── TriggerScrapeForm.tsx     # 'use client' — POST to /api/scrape
├── templates/
│   ├── TemplateForm.tsx          # 'use client' — react-hook-form
│   └── TemplatePreview.tsx       # 'use client' — live token substitution
lib/
└── actions/
    ├── leads.ts                  # Server Actions: updateLeadStatus
    └── templates.ts              # Server Actions: createTemplate, updateTemplate
```

### Pattern 1: URL-State-Driven Paginated Table

**What:** Server Component reads `searchParams` (page, status filter, sort column/dir), queries Supabase with `.range()`, `.order()`, `.eq()`, returns data as props to a Client Component table shell.

**When to use:** Any table where filters must be shareable/bookmarkable and data is server-side.

```typescript
// Source: [CITED: nextjs.org/learn/dashboard-app/adding-search-and-pagination]
// app/dashboard/page.tsx — Server Component
import { createClient } from '@/lib/supabase/server'
import { LeadsTable } from '@/components/leads/LeadsTable'

const PAGE_SIZE = 25

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; sort?: string; dir?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page ?? '1')
  const status = params.status ?? undefined
  const sortCol = params.sort ?? 'created_at'
  const sortDir = params.dir === 'asc' ? true : false  // ascending = true in Supabase

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  let query = supabase
    .from('leads')
    .select('id, name, email, city, source_platform, status, score, created_at', { count: 'exact' })
    .order(sortCol, { ascending: sortDir })
    .range(from, to)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: leads, count } = await query
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return <LeadsTable leads={leads ?? []} totalPages={totalPages} currentPage={page} />
}
```

**CRITICAL:** `searchParams` is a Promise in Next.js 15+. Always `await searchParams` before accessing properties. [VERIFIED: installed Next.js 16.2.2 + CLAUDE.md async-patterns skill note]

### Pattern 2: Server Action for Status Mutation

**What:** Client Component calls a Server Action directly. Server Action validates transition with existing `assertTransition()`, writes to Supabase, calls `revalidatePath`. No API route needed.

**When to use:** Any mutation that needs server-side validation and cache invalidation.

```typescript
// Source: [CITED: nextjs.org/docs/app/getting-started/mutating-data]
// lib/actions/leads.ts
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertTransition, LeadStatus } from '@/lib/state-machine/lead-states'

export async function updateLeadStatus(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus
): Promise<{ error?: string }> {
  try {
    assertTransition(from, to)  // throws on invalid transition
  } catch {
    return { error: `Invalid transition: ${from} -> ${to}` }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/leads/${leadId}`)
  return {}
}
```

```typescript
// components/leads/LeadStatusSelect.tsx — 'use client'
'use client'
import { useOptimistic, useTransition } from 'react'
import { updateLeadStatus } from '@/lib/actions/leads'
import { LeadStatus, canTransition } from '@/lib/state-machine/lead-states'

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: {
  leadId: string
  currentStatus: LeadStatus
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus)
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: LeadStatus) => {
    if (!canTransition(currentStatus, next)) return
    startTransition(async () => {
      setOptimisticStatus(next)
      await updateLeadStatus(leadId, currentStatus, next)
    })
  }

  // Render only allowed transitions as options
  // ...
}
```

### Pattern 3: nuqs for Filter State

**What:** `useQueryState` from nuqs replaces `useState` for any value that should live in the URL. The value syncs to the URL query string automatically; Server Components see it via `searchParams`.

**When to use:** Filter dropdowns, search inputs, pagination controls.

```typescript
// Source: [CITED: nuqs.dev]
// components/leads/LeadsFilters.tsx — 'use client'
'use client'
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'

export function LeadsFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  return (
    <select
      value={status}
      onChange={(e) => {
        setStatus(e.target.value || null)
        setPage(1)  // reset to page 1 when filter changes
      }}
    >
      <option value="">All statuses</option>
      {/* LeadStatus values */}
    </select>
  )
}
```

**nuqs NuqsAdapter requirement:** nuqs 2.x requires wrapping the app with `<NuqsAdapter>`. In Next.js App Router, add it to `app/layout.tsx` or `app/dashboard/layout.tsx`:

```typescript
// Source: [CITED: nuqs.dev/docs]
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
```

### Pattern 4: Template Editor with Live Preview

**What:** Textarea for subject/body + Client Component that substitutes `{name}`, `{city}`, `{category}` tokens with sample values on every keystroke.

**When to use:** Email template create/edit form (DASH-06).

```typescript
// components/templates/TemplatePreview.tsx — 'use client'
'use client'

const SAMPLE = { name: 'Anna Kowalska', city: 'Kraków', category: 'biżuteria' }

function substituteTokens(template: string): string {
  return template
    .replace(/\{name\}/g, SAMPLE.name)
    .replace(/\{city\}/g, SAMPLE.city)
    .replace(/\{category\}/g, SAMPLE.category)
}

export function TemplatePreview({ body }: { body: string }) {
  return (
    <div className="border rounded p-4 bg-gray-50 text-sm whitespace-pre-wrap font-mono">
      {substituteTokens(body)}
    </div>
  )
}
```

The Server Action for template save validates with zod schema before writing:

```typescript
// lib/actions/templates.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const TemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  sequence_position: z.number().int().min(0),
})

export async function saveTemplate(
  id: string | null,
  data: unknown
): Promise<{ error?: string; id?: string }> {
  const parsed = TemplateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  if (id) {
    const { error } = await supabase.from('email_templates').update(parsed.data).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/templates')
    return { id }
  } else {
    const { data: row, error } = await supabase
      .from('email_templates')
      .insert(parsed.data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/dashboard/templates')
    return { id: row.id }
  }
}
```

### Pattern 5: Scrape Job Trigger (DASH-07)

**What:** Client Component form sends POST to the existing `/api/scrape` route. Job status can be polled from `scrape_jobs` table or shown via Supabase Realtime channel.

**When to use:** "Run scrape" button on dashboard.

```typescript
// components/leads/TriggerScrapeForm.tsx — 'use client'
// POST to /api/scrape (already built in Phase 2 at app/api/scrape/route.ts)
// Show job status by polling scrape_jobs table or Supabase Realtime subscription
```

The existing `POST /api/scrape` route already:
- Creates a `scrape_jobs` record with `status: 'pending'`
- Dispatches a `pg-boss` job with the scrape config
- Returns `{ jobId }` for status polling

For job progress display: a simple client-side poll every 3-5 seconds hitting a new `GET /api/scrape/[jobId]` route is sufficient for MVP. Supabase Realtime is more elegant but adds complexity — polling is simpler and reliable at this scale.

### Anti-Patterns to Avoid

- **Fetching data in Client Components with useEffect + fetch:** Use Server Components instead. Data is fetched on the server, no client waterfall.
- **Putting filter/sort state in React useState only:** State is lost on navigation and not shareable. Use URL params via nuqs.
- **Calling Server Actions from Server Components:** Server Actions are for client-triggered mutations. Server Components call DB directly.
- **Using the service role key in the Supabase client:** The existing `lib/supabase/server.ts` correctly uses the anon key. Never change this to the service role key — this is a locked security decision.
- **Skipping `assertTransition()` before status updates:** Every status write MUST call `assertTransition(from, to)` from the state machine — this is INFR-02 and a locked invariant.
- **Not awaiting searchParams:** In Next.js 15+, `searchParams` is a Promise. Accessing `.status` without `await` returns undefined silently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe URL filter state | Custom `useSearchParams` wrappers | nuqs `useQueryState` | Handles serialization, debouncing, React 18 transitions, and null-clearing out of the box |
| Table column sorting / pagination state | Custom sort state + handlers | @tanstack/react-table column defs | Handles ascending/descending toggle, multi-column sort, pagination model — type-safe column accessors |
| Form validation before template save | Manual string checks | zod + react-hook-form resolver | Already in project; handles nested errors, dirty state, submit prevention |
| Lead status validation | Inline if/else checks | `assertTransition()` from `lib/state-machine/lead-states.ts` | Already built and tested — 25 tests passing |
| Token substitution engine | Custom parser | String `.replace()` with `{token}` patterns | Tokens are simple named placeholders, not a template language — regex replace is the right tool |

**Key insight:** The most expensive parts of this phase (state machine, DB schema, job queue, Supabase clients) are already built. Phase 3 is primarily wiring existing infrastructure to a UI.

---

## Common Pitfalls

### Pitfall 1: searchParams is a Promise in Next.js 15+

**What goes wrong:** `searchParams.status` returns `undefined` instead of the URL value; filters silently don't work.

**Why it happens:** Next.js 15 made `searchParams` (and `params`) async Promises. Accessing them synchronously returns the Promise object, not the value.

**How to avoid:** Always `const params = await searchParams` before accessing any field.

**Warning signs:** Filter controls don't affect table output; no error thrown.

### Pitfall 2: nuqs requires NuqsAdapter in layout

**What goes wrong:** `useQueryState` throws "Missing NuqsAdapter" error at runtime; app crashes.

**Why it happens:** nuqs 2.x requires a context provider to know which framework's router to use.

**How to avoid:** Add `<NuqsAdapter>` from `'nuqs/adapters/next/app'` to `app/layout.tsx` or `app/dashboard/layout.tsx` before any component uses `useQueryState`.

**Warning signs:** Unhandled error: "useNuqsReactAdapter must be used inside a NuqsAdapter".

### Pitfall 3: Stale table data after Server Action mutation

**What goes wrong:** User changes a lead status; table still shows old status until manual refresh.

**Why it happens:** `revalidatePath` was not called, or was called with the wrong path.

**How to avoid:** Call `revalidatePath('/dashboard')` in every Server Action that mutates leads. For the lead detail page, also call `revalidatePath(`/dashboard/leads/${leadId}`)`.

**Warning signs:** UI appears to succeed (no error) but data is stale after status change.

### Pitfall 4: TanStack Table v8 with server-side data requires `manualPagination: true`

**What goes wrong:** Table tries to paginate client-side on the current page's 25 rows instead of the full dataset; "page 2" button shows rows 26-50 of the 25 you already fetched, which are blank.

**Why it happens:** By default, TanStack Table assumes all data is loaded client-side. Without `manualPagination: true` it will try to slice the already-paginated data.

**How to avoid:** Set `manualPagination: true` and provide `rowCount` (total count from Supabase) when constructing the table with `useReactTable()`.

**Warning signs:** Pagination controls appear but show wrong or empty data on pages > 1.

### Pitfall 5: Status dropdown shows invalid transitions

**What goes wrong:** User sees "contacted" as an option for a lead in `new` status; clicking it triggers an error from `assertTransition`.

**Why it happens:** The dropdown renders all 9 statuses instead of only the valid next states for the current status.

**How to avoid:** Filter the `<option>` list using `VALID_TRANSITIONS[currentStatus]` from `lib/state-machine/lead-states.ts`. The state machine's `VALID_TRANSITIONS` map is the authority.

**Warning signs:** User gets an error toast after selecting a status that looks valid.

### Pitfall 6: Supabase `.order()` required for stable pagination

**What goes wrong:** Different pages return the same or missing rows; users see duplicates.

**Why it happens:** Without an explicit `.order()` clause, PostgreSQL returns rows in undefined order. Page boundaries shift across queries.

**How to avoid:** Always chain `.order('created_at', { ascending: false })` (or the user-selected sort column). Use `created_at` as a secondary sort when a non-unique column is the primary sort key.

**Warning signs:** Users report seeing the same lead on multiple pages, or missing leads when paginating.

---

## Code Examples

### Supabase Paginated Query with Filters

```typescript
// Source: [CITED: supabase.com/docs/guides/getting-started/quickstarts/nextjs]
const { data, count, error } = await supabase
  .from('leads')
  .select('id, name, email, city, source_platform, status, score, created_at', { count: 'exact' })
  .eq('status', filterStatus)          // omit line if no filter
  .order('created_at', { ascending: false })
  .range(from, to)                     // from = (page-1)*PAGE_SIZE, to = from + PAGE_SIZE - 1
```

### Email History for Lead Detail

```typescript
// app/dashboard/leads/[id]/page.tsx — Server Component
const { data: emailEvents } = await supabase
  .from('email_events')
  .select('id, sequence_number, status, sent_at, replied_at, template_id')
  .eq('lead_id', params.id)
  .order('created_at', { ascending: true })
```

### TanStack Table Setup (Client Component)

```typescript
// Source: [CITED: tanstack.com/table/v8/docs/guide/pagination]
// components/leads/LeadsTable.tsx — 'use client'
'use client'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import type { Lead } from '@/lib/db/types'

const columns: ColumnDef<Lead>[] = [
  { accessorKey: 'name', header: 'Nazwa' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'city', header: 'Miasto' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'score', header: 'Score' },
]

export function LeadsTable({
  leads,
  totalPages,
  currentPage,
  rowCount,
}: {
  leads: Lead[]
  totalPages: number
  currentPage: number
  rowCount: number
}) {
  const table = useReactTable({
    data: leads,
    columns,
    manualPagination: true,         // REQUIRED: data is pre-paginated server-side
    rowCount,                       // total rows in DB for pagination controls
    getCoreRowModel: getCoreRowModel(),
  })
  // render table.getRowModel().rows ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` and `searchParams` as sync objects | `params`/`searchParams` are Promises — must `await` | Next.js 15 | Silent `undefined` bugs if not awaited |
| `cookies()` as sync call | `await cookies()` required | Next.js 15 | Already handled in `lib/supabase/server.ts` |
| Server Actions experimental | Server Actions stable | Next.js 14 | No `experimental.serverActions` flag needed |
| `revalidatePath` in `next/cache` | `revalidatePath` still in `next/cache` | — | No change |
| `useOptimistic` not available | Stable in React 19 (Next.js 16 uses React 19) | React 19 | Use for instant status change feedback |

**Deprecated/outdated:**
- `experimental: { serverActions: true }` in next.config: removed, Server Actions are stable
- `cookies()` without await: will throw in Next.js 15+

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | nuqs `NuqsAdapter` import path is `'nuqs/adapters/next/app'` for App Router | Architecture Patterns Pattern 3 | Wrong import path = runtime error; verify against nuqs 2.x docs before coding |
| A2 | `@tanstack/react-table` v8 `rowCount` option (not `pageCount`) is the current API for server-side total rows | Architecture Patterns Pattern 1 | If API changed, pagination controls won't know total pages; check TanStack v8 docs |
| A3 | react-hook-form 7.x works with React 19 (Next.js 16 ships React 19) | Standard Stack | Potential peer dep conflict; run `npm install react-hook-form` and check for peer warnings before writing form code |

---

## Open Questions

1. **Authentication on the dashboard**
   - What we know: STATE.md note says "Phase 2 has no auth; Phase 3 dashboard adds auth (T-02-10 accepted risk)"
   - What's unclear: Is auth actually required in Phase 3, or is it still deferred? The DASH requirements don't list an auth requirement. The project is single-user (operator only).
   - Recommendation: Treat as out of scope for Phase 3 — the dashboard is a local-run/private tool. Add a TODO comment in the dashboard layout. Phase 4 or a dedicated security phase can add Supabase Auth if the app is deployed publicly.

2. **Scrape job progress display for DASH-07**
   - What we know: `POST /api/scrape` returns `{ jobId }`. The `scrape_jobs` table has `status`, `leads_found`, `leads_new`, `completed_at`.
   - What's unclear: Does the user need live progress (Realtime) or is a manual "check status" / auto-poll sufficient?
   - Recommendation: Use a simple client-side poll (3s interval, stop when `status === 'completed'` or `'failed'`) hitting a `GET /api/scrape/[jobId]` route. Supabase Realtime adds complexity not warranted at MVP.

3. **Dashboard navigation structure**
   - What we know: App currently has only `/dashboard`. Phase 3 adds leads detail, templates, scrape trigger.
   - What's unclear: Should templates and scrape trigger be separate pages or panels within the main dashboard?
   - Recommendation: Separate routes (`/dashboard/templates`, `/dashboard/templates/[id]`, `/dashboard/scrape`). Easier to navigate and link to, consistent with Next.js App Router conventions. A shared `app/dashboard/layout.tsx` provides the nav sidebar.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server | ✓ | 22.22.0 | — |
| nuqs | Filter/pagination URL state | not installed | — | Install: `npm install nuqs` |
| @tanstack/react-table | Lead table | not installed | — | Install: `npm install @tanstack/react-table` |
| react-hook-form | Template form | not installed | — | Install: `npm install react-hook-form` |
| Supabase (live project) | All DB operations | UNKNOWN | — | Need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` |

**Missing dependencies with no fallback:**
- Live Supabase connection: the dashboard is useless without real data. STATE.md open item: "Real Supabase values needed in .env.local before npm run dev can connect to database." This must be resolved before Phase 3 can be tested end-to-end.

**Missing dependencies with fallback:**
- nuqs / @tanstack/react-table / react-hook-form: install via npm, no alternatives needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |
| Environment | `node` (current — UI tests require jsdom) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Supabase paginated query builds correctly (page, filter, sort) | unit | `npm test -- tests/leads-query.test.ts` | ❌ Wave 0 |
| DASH-02 | `updateLeadStatus` Server Action validates transition and writes to DB | unit | `npm test -- tests/actions/leads.test.ts` | ❌ Wave 0 |
| DASH-03 | Email history query returns events ordered by created_at | unit | `npm test -- tests/leads-query.test.ts` | ❌ Wave 0 |
| DASH-06 | `saveTemplate` validates zod schema, rejects empty name/subject/body | unit | `npm test -- tests/actions/templates.test.ts` | ❌ Wave 0 |
| DASH-06 | Token substitution replaces all three tokens in preview | unit | `npm test -- tests/template-preview.test.ts` | ❌ Wave 0 |
| DASH-07 | `POST /api/scrape` route integration (already tested via Phase 2) | existing | `npm test` | ✅ (Phase 2) |

**Note on async Server Components:** Vitest does not support async Server Components directly. Test the Server Action functions (pure async functions) in isolation with mocked Supabase client — same pattern used in Phase 1/2 tests. UI component testing (Client Components) would require adding `@vitejs/plugin-react` + jsdom environment — this is optional for Phase 3 given the low logic complexity in UI components.

### Sampling Rate

- **Per task commit:** `npm test` (existing 30+ tests must stay green)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/leads-query.test.ts` — covers DASH-01 and DASH-03 (Supabase query builder helpers)
- [ ] `tests/actions/leads.test.ts` — covers DASH-02 (updateLeadStatus Server Action logic)
- [ ] `tests/actions/templates.test.ts` — covers DASH-06 save/validate
- [ ] `tests/template-preview.test.ts` — covers DASH-06 token substitution

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (single-user local tool, auth deferred) | — |
| V3 Session Management | No | — |
| V4 Access Control | No (deferred) | — |
| V5 Input Validation | Yes | zod schema on all Server Action inputs |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted `to` status value bypassing state machine | Tampering | `assertTransition()` called server-side before every DB write — INFR-02 invariant |
| Template body with XSS payload displayed in preview | Tampering | Preview renders in `<div className="whitespace-pre-wrap">` not via `dangerouslySetInnerHTML` — plain text only |
| SQL injection via filter/sort params | Tampering | Supabase JS client uses parameterized queries; column names for `.order()` should be validated against an allowlist |
| Service role key exposed via NEXT_PUBLIC_ | Information Disclosure | Locked decision from State.md: ANON_KEY only in NEXT_PUBLIC_; service role key never in NEXT_PUBLIC_ prefix |

**Sort column allowlist (important):** The `sort` URL param is passed to `.order()`. Validate it against an explicit allowlist before use:

```typescript
const SORTABLE_COLUMNS = ['created_at', 'score', 'name', 'city', 'status'] as const
type SortableColumn = typeof SORTABLE_COLUMNS[number]

function isSortable(col: string): col is SortableColumn {
  return (SORTABLE_COLUMNS as readonly string[]).includes(col)
}

const sortCol = isSortable(params.sort ?? '') ? params.sort : 'created_at'
```

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] — nuqs@2.8.9, @tanstack/react-table@8.21.3, react-hook-form@7.72.1
- [CITED: nextjs.org/docs/app/getting-started/mutating-data] — Server Actions, revalidatePath, useActionState patterns
- [CITED: nextjs.org/learn/dashboard-app/adding-search-and-pagination] — URL searchParams pattern for paginated tables
- [CITED: tanstack.com/table/v8/docs/guide/pagination] — manualPagination, rowCount option
- [CITED: nuqs.dev] — useQueryState, NuqsAdapter, Next.js App Router integration
- Existing codebase: `lib/state-machine/lead-states.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/db/types.ts`, `app/api/scrape/route.ts` — all read directly

### Secondary (MEDIUM confidence)
- [WebSearch verified] — nuqs used by Supabase, Vercel, Sentry (React Advanced 2025 presentation)
- [WebSearch verified] — TanStack Table v8 stable at 8.21.3; v9 alpha available but do not use
- [WebSearch verified] — Vitest does not support async Server Components; test Server Actions as plain async functions

### Tertiary (LOW confidence)
- [ASSUMED] nuqs NuqsAdapter exact import path for Next.js 16 — verify at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry; all libraries widely used with Next.js App Router
- Architecture: HIGH — patterns derived from official Next.js docs and existing codebase structure
- Pitfalls: HIGH — searchParams async change is documented and verified; others derived from official docs + known TanStack Table behavior

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable ecosystem — Next.js 16, TanStack v8, nuqs 2.x all stable)
